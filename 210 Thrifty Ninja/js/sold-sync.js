/* Live "sold" + "reserved" sync — listens to Firestore for items Ashley has
   marked sold from admin.html, and for items someone just clicked Buy on,
   pulling both off the shop grid in real time so nobody can buy something
   twice.

   Two collections, kept separate on purpose:
   - soldItems: permanent, only writable by a logged-in (Ashley) session.
   - reservations: temporary holds, writable by anonymous buyers too, but
     the security rules only ever let a write set exactly {reservedUntil,
     reservedAt}, capped a few minutes past RESERVE_MINUTES, so a buyer
     can't lock an item forever or touch its real sold status. */
const RESERVE_MINUTES = 15;

function reserveItem(id) {
  const until = firebase.firestore.Timestamp.fromDate(new Date(Date.now() + RESERVE_MINUTES * 60000));
  db.collection("reservations").doc(id).set({
    reservedUntil: until,
    reservedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(err => console.error("Reserve failed:", err));
}

(function () {
  let soldIds = new Set();
  let reservedUntilById = {};

  function render() {
    const now = Date.now();
    const unavailable = new Set(soldIds);
    Object.keys(reservedUntilById).forEach(id => {
      if (reservedUntilById[id] > now) unavailable.add(id);
    });
    PRODUCTS.forEach(p => { p.sold = unavailable.has(p.id); });

    if (typeof updateCategoryCounts === "function") updateCategoryCounts();
    if (typeof renderGrid === "function") renderGrid();
  }

  db.collection("soldItems").onSnapshot(
    (snapshot) => {
      soldIds = new Set(snapshot.docs.filter(d => d.data().sold).map(d => d.id));
      render();
    },
    (err) => console.error("Sold-status sync failed:", err)
  );

  db.collection("reservations").onSnapshot(
    (snapshot) => {
      reservedUntilById = {};
      snapshot.docs.forEach(d => {
        const until = d.data().reservedUntil;
        if (until) reservedUntilById[d.id] = until.toMillis();
      });
      render();
    },
    (err) => console.error("Reservation sync failed:", err)
  );

  // Re-evaluate periodically so an expired reservation reopens on its own,
  // even with no new Firestore write to trigger onSnapshot.
  setInterval(render, 20000);
})();

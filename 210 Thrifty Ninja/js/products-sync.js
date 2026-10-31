/* Live sync of admin-added listings — merges items Ashley adds through
   admin.html's "Add Listing" form into the PRODUCTS array so they show up
   on the shop instantly, with no redeploy of the static catalog. */
(function () {
  db.collection("products").onSnapshot(
    (snapshot) => {
      let changed = false;
      snapshot.docChanges().forEach(change => {
        if (change.type === "removed") return;
        const data = change.doc.data();
        const product = Object.assign({ id: change.doc.id }, data);
        const idx = PRODUCTS.findIndex(p => p.id === product.id);
        if (idx === -1) PRODUCTS.push(product);
        else PRODUCTS[idx] = product;
        changed = true;
      });

      if (!changed) return;
      if (typeof updateCategoryCounts === "function") updateCategoryCounts();
      if (typeof renderGrid === "function") renderGrid();
      if (typeof window.onProductsSynced === "function") window.onProductsSynced();
    },
    (err) => console.error("Product sync failed:", err)
  );
})();

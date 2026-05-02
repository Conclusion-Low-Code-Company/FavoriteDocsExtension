# FavoriteDocs — Manual Test Script

Run through each section top to bottom. Check off each step as you go.
A fresh Studio Pro project with no prior FavoriteDocs data is the ideal starting state.

---

## 1. Extension menu

| # | Action | Expected result |
|---|--------|-----------------|
| 1.1 | Open Studio Pro with the extension loaded | No errors, extension loads silently |
| 1.2 | Click **Extensions → FavoriteDocs → Show Favorites** | Favorites pane opens |
| 1.3 | Close the pane, repeat 1.2 | Pane opens again |

---

## 2. Identity form (first-time / fallback)

> **Setup:** Remove `favorites/.identity` from the project files if it exists, and ensure no git `user.email` is configured (or test in a repo where it isn't). This forces the fallback prompt.

| # | Action | Expected result |
|---|--------|-----------------|
| 2.1 | Open the pane | Identity form is shown (not the favorites table) |
| 2.2 | Leave the name field empty | **Save** button is disabled |
| 2.3 | Type only spaces | **Save** button remains disabled |
| 2.4 | Type a name (e.g. "Bart") | **Save** button becomes enabled |
| 2.5 | Clear the field again | **Save** button disables again |
| 2.6 | Type a name and press **Enter** | Form disappears, empty favorites table is shown |
| 2.7 | Repeat 2.1–2.5, then click **Save** | Same result as 2.6 |

---

## 3. Identity auto-resolution (no prompt)

> **Setup:** Ensure `git config user.email` returns a value in the project repo.

| # | Action | Expected result |
|---|--------|-----------------|
| 3.1 | Open the pane | Identity form is **not** shown — empty favorites table appears immediately |

---

## 4. Adding favorites

> **Setup:** Have the favorites table visible (identity resolved).

| # | Action | Expected result |
|---|--------|-----------------|
| 4.1 | No document open | **+ Add current document** button is disabled (greyed out) |
| 4.2 | Open any document (page, microflow, etc.) | **+ Add current document** button becomes enabled |
| 4.3 | Click **+ Add current document** | The document appears as a row in the table |
| 4.4 | With the same document still active | **+ Add current document** button is now disabled (already in list) |
| 4.5 | Open a different document | **+ Add current document** button becomes enabled again |
| 4.6 | Click **+ Add current document** | Second document appears in the table |

---

## 5. Active document highlight

| # | Action | Expected result |
|---|--------|-----------------|
| 5.1 | Open a document that is in the favorites list | Its row is **bold** with a light blue background |
| 5.2 | Switch to a different document (also in favorites) | Highlight moves to the new active row |
| 5.3 | Open a document that is **not** in favorites | No row is highlighted |

---

## 6. Sorting

> **Setup:** Have at least 3 favorites from different modules and with different types.

| # | Action | Expected result |
|---|--------|-----------------|
| 6.1 | Click **Module** column header | Rows sort by module name A→Z, ▲ indicator appears |
| 6.2 | Click **Module** again | Rows sort Z→A, ▼ indicator appears |
| 6.3 | Click **Name** column header | Rows sort by document name A→Z, ▲ on Name, Module indicator gone |
| 6.4 | Click **Name** again | Rows sort Z→A |
| 6.5 | Click **Type** column header | Rows sort by document type A→Z |
| 6.6 | Click **Type** again | Rows sort Z→A |

---

## 7. Row hover actions

| # | Action | Expected result |
|---|--------|-----------------|
| 7.1 | Hover over a favorite row | ↗ (open) and × (remove) buttons appear in the row |
| 7.2 | Move mouse off the row | Buttons disappear |

---

## 8. Opening a document from favorites

| # | Action | Expected result |
|---|--------|-----------------|
| 8.1 | Double-click a favorite row | That document opens in the editor |
| 8.2 | Hover a row, click the **↗** button | Same document opens in the editor |

---

## 9. Removing a favorite

| # | Action | Expected result |
|---|--------|-----------------|
| 9.1 | Hover a row, click **×** | Row is removed from the table |
| 9.2 | Remove all rows | Table disappears, placeholder text "No favorites yet…" appears |
| 9.3 | With empty list, open a document and click **+ Add current document** | Row reappears — table is restored |

---

## 10. Document not found modal

> **Setup:** Add a document to favorites. Then in Studio Pro, **delete or rename** that document.

| # | Action | Expected result |
|---|--------|-----------------|
| 10.1 | Double-click the stale favorite row (or click ↗) | Modal appears: "The document '...' could not be opened. It may have been deleted or renamed." |
| 10.2 | Click **Keep** | Modal closes, favorite remains in the list |
| 10.3 | Repeat 10.1, then click **Remove from Favorites** | Modal closes, favorite is removed from the list |

---

## 11. Persistence across pane close/reopen

| # | Action | Expected result |
|---|--------|-----------------|
| 11.1 | Add several favorites and set a sort preference | Favorites visible, sort indicator set |
| 11.2 | Close the pane | — |
| 11.3 | Reopen via **Extensions → FavoriteDocs → Show Favorites** | Same favorites shown, same sort order preserved |

---

## 12. Persistence across Studio Pro restart

| # | Action | Expected result |
|---|--------|-----------------|
| 12.1 | Add favorites, close Studio Pro | — |
| 12.2 | Reopen Studio Pro with the same project | Pane auto-resolves identity (no form shown), favorites are restored |

---

## 13. Notification banner (save failure)

> This is hard to trigger manually. To simulate: make the `favorites/` directory read-only, then add a favorite.

| # | Action | Expected result |
|---|--------|-----------------|
| 13.1 | Trigger a save failure (see above) | Yellow banner appears: "Favorites could not be saved. Changes may be lost." |
| 13.2 | Click **×** on the banner | Banner dismisses |

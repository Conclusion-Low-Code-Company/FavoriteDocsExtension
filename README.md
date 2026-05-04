# FavoriteDocs

A Mendix Studio Pro extension that lets you mark documents as favorites and access them instantly from a dedicated pane.

## Installation

Install **FavoriteDocs** from the Mendix Marketplace inside Studio Pro.

## Activation

Open the pane via **Extensions → FavoriteDocs → Show Favorites** in the Studio Pro menu bar.

## First run

The first time you open the pane, you will be asked to create a favorites list by entering a name — your first name works fine. This creates a personal list inside the shared favorites file for this project.

From then on, a dropdown at the top of the pane lets you choose which list to work with. If you are the only developer on the project, your list is selected automatically.

## Usage

### Switching lists

Use the dropdown at the top of the pane to switch between favorites lists. Each team member has their own list — select yours before making changes.

### Creating a new list

Click the **+** button next to the dropdown to create an additional list.

### Adding a favorite

Open any document in Studio Pro, then click **+ Add current document** at the top of the Favorites pane.

### Opening a favorite

**Double-click** any row to open the document.

### Removing a favorite

**Right-click** a row and choose **Remove as favorite**.

### Keyboard navigation

| Key | Action |
|---|---|
| ↑ / ↓ | Move between rows |
| Enter | Open the focused document |
| Delete / Backspace | Remove the focused document |

### Sorting

Click the **Name** column header to sort alphabetically. Click the icon column header to sort by document type. Click again to reverse the order.

### Tooltip

Hover over any row to see the full document name and its module.

## Favorites file

All favorites lists are stored together in a single `favoriteDocs/favorite-docs.json` file inside your Mendix project directory. The file is committed to git so favorites are shared across machines and team members can each maintain their own list within it.

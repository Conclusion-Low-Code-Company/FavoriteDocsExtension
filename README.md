# FavoriteDocs

A Mendix Studio Pro extension that lets you mark documents as favorites and access them instantly from a dedicated pane.

## Installation

Install **FavoriteDocs** from the Mendix Marketplace inside Studio Pro.

## Activation

Open the pane via **Extensions → FavoriteDocs → Show Favorites** in the Studio Pro menu bar.

## First run

The first time you open the pane, you will be asked to enter a name. This name identifies your personal favorites file within the project. Choose anything you like — your first name works fine. You will not be asked again on this machine.

> If you work on the same project from multiple machines, enter the same name on each machine to share the same favorites file.

## Usage

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

Your favorites are stored in a `favorites/` folder inside your Mendix project directory and committed to git. Each team member has their own file, so favorites don't interfere with each other.

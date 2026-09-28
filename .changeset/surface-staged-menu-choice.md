---
"@axe/surface": patch
---

Treat a menu item as reversible form state when it is staged inside a dialog and a separate
Continue, Apply, or Save-style control commits the choice. Destructive wording and styling still
remain high risk. This prevents workspace, tenant, account, and similar pickers from requesting
approval merely to select an option.

# Journal and Photo Recap

> Extends [MASTER.md](../MASTER.md). These rules apply to Journal discovery, its filter sheet, and the calendar-year photo recap.

## Journal

- Keep dish-name search visible above the reverse-chronological list. Put country, year/month, and rating controls in a modal bottom sheet rather than widening the page.
- Commit filter-sheet changes only through **Show results**. Closing the sheet leaves the applied filters unchanged and restores focus to **Filters**.
- Represent applied country, date, and rating filters as removable 44-pixel chips. Search stays in its labeled field rather than becoming a chip.
- State the visible result count and provide a single recovery action when no cooks match.
- Preserve query, filters, scroll position, and the originating cook control across detail navigation.
- Render one card per cooking occasion. The card names every dish, uses the occasion main photograph, and summarizes per-dish ratings without splitting the meal into duplicate rows.
- Search, country, and rating criteria must be satisfied by the same dish attempt within an occasion; unrelated dishes in the same meal cannot combine to create a false match.

## Photo recap

- Enter from both Year and Journal without adding a bottom-navigation destination.
- Default to the current calendar year, offer archived years, and never borrow photographs from another year for an empty state.
- Group every saved occasion and dish photograph under nonempty months in newest-first calendar order. Use a two-column photo grid on iPhone portrait.
- Each photo is one large semantic button with dish, month/day, and rating or Not rated in its accessible name.
- Back from a cook restores the selected recap year, scroll position, and originating photo. Back from recap restores its Year or Journal origin.

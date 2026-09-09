# What I Made Discovery Brief

**Status:** Draft for owner approval  
**Evidence:** Direct discovery conversation with the owner and sole intended user, August 29, 2026

## Decision snapshot

The first release is a personal cooking journal for iPhone. Its core value is helping the owner capture what they cooked in under 20 seconds, then see new dishes and the evolution of repeated dishes through photos, ratings, and notes. The emotional outcome is pride, inspiration, and a durable sense of culinary exploration—not productivity pressure or habit enforcement.

The product priority is:

1. Capture immediately after cooking.
2. Browse history and see progression.
3. Decide what to cook in a later release.
4. Get live cooking assistance in a later release.

An installable web app is the selected first-release platform because a home-screen icon and full-screen iPhone experience are sufficient. The supporting comparison and migration boundary are documented in `docs/technical/pwa-foundation/design.md`.

## Problem framing narrative

**I am:** A frequent home cook who prepares roughly four or five dinners and three or four lunches each week. I cook for the inherent value of the activity and want to appreciate the body of work I am creating over time.

**Trying to:** Remember what I cooked, recognize the new dishes and countries I explored, and see how familiar dishes improved across repeated attempts.

**But:** I normally eat the food without recording it. I sometimes take a photo when I particularly like a result and may say a review aloud to my wife, but I do not consistently save names, ratings, or notes.

**Because:** Capturing a structured cooking record requires extra effort at the exact moment I am ready to eat, and my ordinary photo library does not connect food photos to dishes, attempts, ratings, countries, or reflections.

**Which makes me feel:** That the context and progress behind a large amount of cooking disappear, limiting the pride, satisfaction, and inspiration I could get from looking back.

## Final problem statement

A frequent home cook needs a nearly effortless way to preserve and revisit each cooking attempt because the current photo-and-memory-based behavior loses the context of what was made and learned, making years of exploration and improvement difficult to see or appreciate.

## Primary user

This is a single-user product for its owner. This profile is based on direct statements rather than assumed market demographics.

### Known behaviors and context

- Cooks approximately seven to nine lunches and dinners in a typical week.
- Uses an iPhone and is comfortable installing a web app from the home screen; App Store distribution is unnecessary.
- Usually has Wi-Fi or cellular data, so offline capture is not required.
- Does not currently maintain a food journal or structured cooking archive.
- Sometimes photographs especially successful meals.
- Naturally expresses reviews aloud and prefers voice input over typing.
- Has limited technical expertise and intends to build and maintain the product personally with Codex assistance.
- Wants ongoing operating costs to remain below $10 per month.

### Attitudes that affect adoption

- The app must not turn cooking into an obligation.
- Streaks and generic reminders are not motivating and are out of scope.
- Optional details must remain optional and editable later.
- AI suggestions should save effort but never override the owner's judgment.
- The experience should feel warm, tactile, and exploratory, with photography as important evidence rather than a generic analytics dashboard.

## Jobs to be Done

### Core functional job

When I have just finished cooking and am ready to eat, help me preserve a recognizable record of what I made with almost no effort, so that my cooking history becomes useful instead of disappearing.

### Core emotional job

When I look back at months or years of cooking, help me feel proud and inspired by the dishes I explored and the skills I developed.

### Supporting jobs, in priority order

1. Show which dishes are new and which are repeat attempts.
2. Let me compare photos and ratings across attempts of the same dish.
3. Preserve chronological notes that explain what changed or could improve next time.
4. Show dish-level geographic exploration on a world map.
5. Summarize the current year and produce a calendar-year photo recap.
6. Later, recommend what to cook from available time, ingredients, history, and a wish list.
7. Later, provide conversational help while cooking.

### Pains

- The moment after plating has very little tolerance for data entry.
- Most cooking context currently disappears after the meal.
- Ordinary photo libraries do not group attempts of the same dish or explain progression.
- Dish names and cultural origins can be ambiguous, so automatic classification can be wrong.
- A personal archive that is difficult to back up would become risky as it grows.

### Desired gains

- A normal capture takes less than 20 seconds.
- Voice can turn a natural spoken review into useful structured information.
- New dishes and improving repeat dishes are immediately visible.
- Photos, ratings, and notes tell a coherent story of each dish over time.
- The dashboard and map create pride and inspiration without gamified pressure.
- Data remains owned, editable, exportable, and restorable by the user.

## First-release workflow

1. Start a cooking occasion from the iPhone home-screen app.
2. Take a main photo or select one from the photo library.
3. Provide the dish name, preferably through voice capture.
4. Optionally speak or enter a whole-number rating from 1–10, notes, and informal ingredients.
5. Review an AI-assisted structured draft and correct it if necessary.
6. Confirm or change the suggested country and possible match to an existing dish.
7. Save the occasion.
8. Later, edit any field, add optional photos for individual dishes, or merge dishes that were mistakenly separated.
9. Browse the current-year dashboard, dish map, chronological journal, and repeat-dish pages.

## First-release requirements

### Entry model

- A cooking occasion is the primary log entry and contains one or more dishes.
- One dish is the default; multiple dishes are supported for flexible cases.
- Reheating or eating leftovers is not a new cooking occasion.
- A main photo and dish name are required.
- Optional additional photos can be associated with individual dishes.
- The date is automatic and editable.
- Rating, notes, and ingredients are optional and editable later.
- Ratings are whole numbers from 1–10.
- Ingredients are informal text, not structured quantities or nutrition data.

### Assistance and classification

- Voice input is transcribed and parsed into a proposed dish name, rating, notes, and ingredients.
- The user sees a quick confirmation screen before saving.
- Country is the only origin classification in version one. It is suggested from the dish information and remains editable.
- The app derives an initial dish-level map point from the confirmed country; the owner can adjust that point later from the dish or map view.
- When a new entry resembles an existing dish, the app suggests a match and the user confirms or rejects it.
- The user can manually merge dishes that were mistakenly separated.
- AI failure must not prevent manual completion of an entry.

### History

- The home dashboard defaults to the current calendar year.
- It emphasizes dishes first tried within the last 30 days and dishes revisited with changing ratings and notes.
- A repeat-dish page leads with photos and rating progression, with chronological notes and a summary of changes available as secondary detail.
- Initial filters are dish, country, date, and rating.
- Initial search covers dish names only.
- A Year in Cooking recap covers a calendar year.

### Map

- The map visualizes individual dishes, not country-level intensity.
- Repeating one dish changes only that dish's cell or column; it does not brighten or enlarge its entire country.
- Each dish has one country and one editable primary map location.
- Approximate locations are acceptable.
- Nearby dish cells may form a dense field until the user zooms in, but each canonical dish remains independently selectable.
- The map offers two views of the same selected-year country activity: Cook Density and Culinary Peaks.
- Cook Density fills represented countries using five sequential bands based on cook count.
- Culinary Peaks uses the same bands while adding capped height and an exact count; photographs remain in the region/country drill-downs.
- The owner can change a dish's default map photo later without changing any cooking record.
- Hex relief, conventional pin, halo, growing-bubble, photo-pin, and milestone-ring treatments have been rejected.

### Data, privacy, and delivery

- Version-one data may live only on the owner's iPhone.
- Historical import is unnecessary; the archive begins when the app is adopted.
- Manual backup and restore use a portable archive saved through Apple Files and include app data plus photos.
- Photos are stored as app-optimized copies.
- Photos are not sent to an AI service in the first release.
- Only text needed for transcription parsing and classification may be sent to an external AI service.
- No reminders, streaks, social accounts, or App Store release are required.
- The app may require an internet connection.
- Ongoing hosting and AI costs should remain below $10 per month.

## Success signals

The first release is successful when:

- A normal cooking occasion can be captured in less than 20 seconds.
- The owner records most dishes they cook.
- New dishes tried in the last 30 days are easy to identify.
- Repeated attempts clearly show evolution through photos, ratings, dates, and notes.
- The dashboard or map makes the owner feel proud or inspired enough to revisit the app voluntarily.
- Backup and restore work without requiring a cloud account.

Because this is a private single-user product, these signals should be evaluated through direct use and local product behavior rather than third-party analytics.

## Explicitly outside the first release

- Wish lists and meal recommendations
- Suggestions based on available ingredients and time
- Live conversational cooking assistance
- Macro or nutrition tracking
- Sentiment analysis of notes
- Automatic cloud sync or multi-device history
- Historical photo-library import
- Shared household accounts or social features
- Cooking streaks and generic reminders
- App Store distribution
- Structured recipes or structured ingredient quantities

## Open design and technical decisions

- Validate the selected installable web app on the owner's actual iPhone; preserve the documented migration boundary for React Native with Expo.
- Validate Cook Density and Culinary Peaks on the owner's iPhone, including sequential-color legibility, crowded regions, peak readability, shelves, and VoiceOver summaries.
- Determine the precise photo optimization and portable backup formats during technical design.
- Define how voice transcription and text classification can remain within the monthly cost ceiling.
- Explore a visual direction that blends a warm personal cooking journal with an exploratory world-food atlas; avoid both sterile analytics and heavy gamification.

# The Timetable Register — Documentation

A whole-school timetable scheduling application for Lyceum International School, Kurunegala. Generates clash-free schedules for all 7 grades (6–12), handling buckets, merged classes, religion blocks, and shared teachers.

## Documents

| # | Document | Description |
|---|----------|-------------|
| 1 | [01-user-guide.md](01-user-guide.md) | Step-by-step user guide — navigating the app, viewing timetables, exporting |
| 2 | [02-scheduling-logic.md](02-scheduling-logic.md) | How the generation algorithm works — passes, round-robin, caps, interleaving |
| 3 | [03-issues-panel.md](03-issues-panel.md) | Issues panel explained — columns, warning types, fix actions |
| 4 | [04-data-model.md](04-data-model.md) | Data structure — grades, subjects, buckets, merged groups, periods |
| 5 | [05-troubleshooting.md](05-troubleshooting.md) | Common problems and their resolutions |

## Quick Reference

- **App URL:** https://tt-app-lime.vercel.app
- **Schedule period:** 2026
- **Periods per day:** 8 (interval after Period 4)
- **School days:** Monday – Friday
- **Grades:** 6, 7, 8, 9, 10, 11, 12
- **Generator:** JavaScript (local) — runs in-browser / on-server
- **Data storage:** MongoDB Atlas (optional, falls back to bundled JSON)

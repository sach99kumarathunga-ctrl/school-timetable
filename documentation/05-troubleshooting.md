# Troubleshooting

## Common Problems and Solutions

### 1. Too Many Warnings After Regeneration

**Symptom:** The Issues panel shows 15+ warnings, most from Grade 11 or 12.

**Cause:** Grade 11 and 12 classes have 43 periods of subjects but only 39 available slots (40 − 1 assembly). 4 periods per class must fail.

**Solutions:**
1. **Accept the warnings** — the most critical subjects (academic buckets, core subjects) are placed. Warnings are mostly for activities like Motivational, PE, Library that could not fit.
2. **Click Fix on individual issues** to reduce their period count and regenerate.
3. **Reduce subject periods in the data editor** to bring total under 39 per class.

### 2. nat_g12_b1 Only Gets 5–6 Slots

**Symptom:** The bucket `nat_g12_b1` (Physics + Accounting for Grade 12 NAT) shows short 5–6.

**Cause:** Ms. Rusiri Jayakodi teaches 4 academic buckets (44 periods total) but only has 40 physical slots per week. The generator places as many as possible.

**This is expected behavior.** Ms. Rusiri teaches:
- Grade 11 NAT Accounting (11 periods)
- Grade 11 PED Business (11 periods)
- Grade 12 NAT Accounting (11 periods)
- Grade 12 PED Business (11 periods)

Total: 44 periods, but maximum is 8/day × 5 days = 40. 4 periods cannot be placed.

**No fix is possible without reducing Ms. Rusiri's workload in the data.**

### 3. Motivational Not Placed

**Symptom:** `Motivational` shows short: 2 for Grade 11 or 12 PED classes.

**Cause:** Motivational is merged across all 4 classes (taught simultaneously by Mr. Chinthaka). It needs a slot where all 4 classes are free. After academic buckets consume 33 of the 39 slots, the intersection of free slots across all classes is empty or has only 1 slot (needs 2).

**Solutions:**
1. Click **Regenerate All** — sometimes the random shuffle finds a configuration with common free slots.
2. Click **Fix** to reduce Motivational to 0 periods (removes it from the schedule).
3. Reduce the number of bucket periods in the data editor to free up common slots.

### 4. Teacher Has Too Many Periods in One Day

**Symptom:** A teacher has 8 periods on some days and only 4–5 on others.

**Cause:** The generator caps teachers at their computed daily maximum (usually 7, raised to 8 only when total exceeds cap×5). With 44 periods and cap 8, Ms. Rusiri has [8,8,8,7,8] distribution — nearly every slot filled.

**Solutions:**
1. **For Ms. Rusiri:** Accept the imbalance — she has no free room in her schedule.
2. **For other teachers:** Regenerate to get a different random distribution.
3. Reduce the teacher's workload by reassigning some subjects.

### 5. A Specific Class Has Many Empty Slots

**Symptom:** A class's timetable shows many diagonal-hatch cells with no subject.

**Cause:** The class has fewer than 39 periods of subjects assigned in the data model.

**Solutions:**
1. Check the data in the editor — are all subjects correctly assigned?
2. Add missing subjects or increase period counts.
3. Regenerate after data changes.

### 6. Export Shows Wrong Data

**Symptom:** PDF or Excel export shows different data than the on-screen timetable.

**Cause:** The export uses the current state from MongoDB. If you regenerated but didn't save, the export still shows the old data.

**Solutions:**
1. Click **Regenerate All** to generate fresh data.
2. The new result is automatically used for exports.

### 7. "Regenerate All" Shows "busy" but Never Completes

**Symptom:** The Regenerate All button stays disabled and nothing happens.

**Causes:**
- Server-side error (check console/browser dev tools)
- MongoDB connection timeout (if saving)
- Data model is corrupted

**Solutions:**
1. Refresh the page and try again.
2. Check browser console for errors.
3. Verify the data model loads correctly by checking the `/api/model` endpoint.
4. If the issue persists, the bundled `data/data_model.json` is used as fallback.

### 8. Edit Page Shows Red Class Load (>39)

**Symptom:** A class pill turns red with load > 39.

**Cause:** The total core periods + bucket periods for this class exceed the available 39 slots.

**This is not an error** — it's a warning that the generator cannot place all periods. The red class pill highlights classes that will have warnings after generation.

**Solutions:**
1. Reduce subject periods for this class.
2. Reassign some merged subjects to separate per-class slots.
3. Accept the warnings (the generator places as many as possible).

### 9. Data Changes Not Reflected After Save

**Symptom:** You edited data, clicked Save, but the timetable doesn't show the changes.

**Cause:** Data was saved but the timetable wasn't regenerated.

**Solution:** Go to the main page and click **Regenerate All**.

### 10. "No classes found" When Searching

**Symptom:** The class search shows "No classes found" for a valid query.

**Cause:** Typo in the search query, or the class belongs to a grade not loaded.

**Solutions:**
1. Try a different search term (e.g. search for just the number: `6` instead of `6A`).
2. Check that the data model includes the grade containing this class.
3. Refresh the page to reload data.

## Error Messages

| Message | Cause | Action |
|---------|-------|--------|
| "Loading the register…" | Initial data load | Wait for the app to load |
| "Something went wrong" + stack trace | React error boundary | Click **Retry** or refresh |
| "Failed to regenerate" (console) | Generator threw an exception | Check the data model format |
| "No teachers found" | Teacher search has no matches | Try a different name |
| "Saved to MongoDB. Set MONGODB_URI to persist regenerated plans." | No MongoDB connection | Data is in-memory only; add MONGODB_URI for persistence |

## Getting Help

If issues persist:
1. Check the browser console for error messages.
2. Verify the data model at `/api/model`.
3. Check that `MONGODB_URI` is set correctly if using database persistence.
4. Report issues at the project's issue tracker.

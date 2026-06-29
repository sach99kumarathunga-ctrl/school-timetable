import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const model = JSON.parse(readFileSync(join(__dirname, "..", "data", "data_model.json"), "utf8"));

// Helper: add missing fields to assignments
function fixAssignments(assignments) {
  for (const a of assignments) {
    if (a.mergedGroup === undefined) {
      a.mergedGroup = a.classes.length > 1 ? [...a.classes] : null;
    }
    if (a.periods === undefined) a.periods = a.weekly || 1;
  }
}

// Fix Grade 9 and 10
for (const grade of model.grades) {
  if (grade.grade === "Grade 9" || grade.grade === "Grade 10") {
    for (const s of grade.subjects) {
      if (s.religionBlock === undefined) s.religionBlock = false;
      fixAssignments(s.assignments);
    }
  }
}

// Grade 11 - complete rewrite per spec
const grade11 = {
  "grade": "Grade 11",
  "classes": ["11 PED SCI", "11 PED COM", "11 NAT SCI", "11 NAT COM"],
  "subjects": [
    { "subject": "Physics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Kavindya", "classes": ["11 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Accounting", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Rusiri Jayakodi", "classes": ["11 NAT COM"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Chemistry", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Tharindu", "classes": ["11 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Business", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Thakshila Ruwanthi", "classes": ["11 PED COM"], "periods": 11, "mergedGroup": null }] },
    { "subject": "ICT", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Hashini Dissanayake", "classes": ["11 NAT SCI", "11 NAT COM"], "periods": 11, "mergedGroup": ["11 NAT SCI", "11 NAT COM"] }] },
    { "subject": "Biology", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Charuni", "classes": ["11 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Combined Mathematics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Nimeshika", "classes": ["11 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Economics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Ashka Wikramasinghe", "classes": ["11 NAT COM"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Economics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Senani Jayawardena", "classes": ["11 PED COM"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Biology", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Vidya Rajasekara", "classes": ["11 PED SCI"], "periods": 1, "mergedGroup": null }] },
    { "subject": "Mathematics/c", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Chinthaka Herath", "classes": ["11 PED SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Physics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Radun", "classes": ["11 PED SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Accounting", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Sanjeewa Narayana", "classes": ["11 PED COM"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Chemistry", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Hasini Rathnathilake", "classes": ["11 PED SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Business", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Rusiri Jayakodi", "classes": ["11 PED SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Information Technology", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "New TE (Grade 11)", "classes": ["11 PED SCI", "11 PED COM"], "periods": 11, "mergedGroup": ["11 PED SCI", "11 PED COM"] }] },
    { "subject": "PE", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [
      { "teacher": "NEW PHE 2 (Grade 11)", "classes": ["11 NAT SCI", "11 NAT COM"], "periods": 1, "mergedGroup": ["11 NAT SCI", "11 NAT COM"] },
      { "teacher": "NEW PHE 2 (Grade 11)", "classes": ["11 PED SCI", "11 PED COM"], "periods": 1, "mergedGroup": ["11 PED SCI", "11 PED COM"] }
    ]},
    { "subject": "EM/WM/CUD/Art", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "New ACT (Grade 11)", "classes": ["11 NAT SCI", "11 NAT COM"], "periods": 1, "mergedGroup": ["11 NAT SCI", "11 NAT COM"] }] },
    { "subject": "Motivational", "weekly": 2, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [
      { "teacher": "Mr. Chinthaka", "classes": ["11 NAT SCI", "11 NAT COM"], "periods": 2, "mergedGroup": ["11 NAT SCI", "11 NAT COM"] },
      { "teacher": "Mr. Chinthaka", "classes": ["11 PED SCI", "11 PED COM"], "periods": 2, "mergedGroup": ["11 PED SCI", "11 PED COM"] }
    ]},
    { "subject": "General English", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Vindya", "classes": ["11 NAT SCI", "11 NAT COM"], "periods": 1, "mergedGroup": ["11 NAT SCI", "11 NAT COM"] }] },
    { "subject": "Effective Speech", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [
      { "teacher": "Ms. Shiremila", "classes": ["11 NAT SCI", "11 NAT COM"], "periods": 1, "mergedGroup": ["11 NAT SCI", "11 NAT COM"] },
      { "teacher": "Ms. Shiremila", "classes": ["11 PED SCI", "11 PED COM"], "periods": 1, "mergedGroup": ["11 PED SCI", "11 PED COM"] }
    ]},
    { "subject": "EM/WM/CUD/Art", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "New ACT (Grade 11)", "classes": ["11 PED SCI", "11 PED COM"], "periods": 1, "mergedGroup": ["11 PED SCI", "11 PED COM"] }] },
    { "subject": "Recreational", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Shiremila", "classes": ["11 PED SCI", "11 PED COM"], "periods": 1, "mergedGroup": ["11 PED SCI", "11 PED COM"] }] }
  ],
  "buckets": []
};

const grade12 = {
  "grade": "Grade 12",
  "classes": ["12 PED SCI", "12 NAT SCI", "12 PED COM", "12 NAT COM"],
  "subjects": [
    { "subject": "Physics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Kavindya", "classes": ["12 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Chemistry", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Tharindu", "classes": ["12 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "ICT", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Hashini Dissanayake", "classes": ["12 PED SCI", "12 NAT SCI", "12 PED COM"], "periods": 11, "mergedGroup": ["12 PED SCI", "12 NAT SCI", "12 PED COM"] }] },
    { "subject": "Biology", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Charuni", "classes": ["12 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Combined Mathematics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Nimeshika", "classes": ["12 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Economics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Senani Jayawardena", "classes": ["12 PED COM"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Biology", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Vidya Rajasekara", "classes": ["12 PED SCI", "12 PED COM"], "periods": 1, "mergedGroup": ["12 PED SCI", "12 PED COM"] }] },
    { "subject": "Mathematics/c", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Chinthaka Herath", "classes": ["12 PED SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Physics", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Radun", "classes": ["12 PED SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Accounting", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Mr. Sanjeewa Narayana", "classes": ["12 NAT SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Chemistry", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Hasini Rathnathilake", "classes": ["12 PED SCI"], "periods": 11, "mergedGroup": null }] },
    { "subject": "Information Technology", "weekly": 11, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "New TE (Grade 12)", "classes": ["12 PED SCI", "12 NAT SCI"], "periods": 11, "mergedGroup": ["12 PED SCI", "12 NAT SCI"] }] },
    { "subject": "PE", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [
      { "teacher": "NEW PHE 2 (Grade 12)", "classes": ["12 NAT SCI"], "periods": 1, "mergedGroup": null },
      { "teacher": "NEW PHE 2 (Grade 12)", "classes": ["12 PED SCI", "12 PED COM"], "periods": 1, "mergedGroup": ["12 PED SCI", "12 PED COM"] }
    ]},
    { "subject": "EM/WM/CUD/Art", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "New ACT (Grade 12)", "classes": ["12 NAT SCI"], "periods": 1, "mergedGroup": null }] },
    { "subject": "Motivational", "weekly": 2, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [
      { "teacher": "Mr. Chinthaka", "classes": ["12 NAT SCI"], "periods": 2, "mergedGroup": null },
      { "teacher": "Mr. Chinthaka", "classes": ["12 PED SCI", "12 PED COM"], "periods": 2, "mergedGroup": ["12 PED SCI", "12 PED COM"] }
    ]},
    { "subject": "General English", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Vindya", "classes": ["12 NAT SCI"], "periods": 1, "mergedGroup": null }] },
    { "subject": "Effective Speech", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [
      { "teacher": "Ms. Shiremila", "classes": ["12 NAT SCI"], "periods": 1, "mergedGroup": null },
      { "teacher": "Ms. Shiremila", "classes": ["12 PED SCI", "12 PED COM"], "periods": 1, "mergedGroup": ["12 PED SCI", "12 PED COM"] }
    ]},
    { "subject": "EM/WM/CUD/Art", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "New ACT (Grade 12)", "classes": ["12 PED SCI", "12 PED COM"], "periods": 1, "mergedGroup": ["12 PED SCI", "12 PED COM"] }] },
    { "subject": "Recreational", "weekly": 1, "color": "none", "religionBlock": false, "bucketId": null, "assignments": [{ "teacher": "Ms. Shiremila", "classes": ["12 PED SCI", "12 PED COM"], "periods": 1, "mergedGroup": ["12 PED SCI", "12 PED COM"] }] }
  ],
  "buckets": []
};

// Replace Grade 11 and 12
const g11idx = model.grades.findIndex(g => g.grade === "Grade 11");
const g12idx = model.grades.findIndex(g => g.grade === "Grade 12");
if (g11idx >= 0) model.grades[g11idx] = grade11;
if (g12idx >= 0) model.grades[g12idx] = grade12;

writeFileSync(join(__dirname, "..", "data", "data_model.json"), JSON.stringify(model, null, 2), "utf8");
console.log("Done. Grades:", model.grades.map(g => `${g.grade} (${g.classes.length} classes, ${g.subjects.length} subjects)`).join(", "));

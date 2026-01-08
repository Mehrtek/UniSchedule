# UniSchedule

UniSchedule is a modern timetable generator for school or college or university courses. Designed to help students and faculty tune working days, manage instructors, and generate conflict-free schedules with ease.

**Website:** [https://personatable.netlify.app/](https://personatable.netlify.app/)

## Features

- **Course Management**: Add, search, and manage university courses.
- **Auto-Scheduler**: Conflict-free timetable generation logic.
- **Customizable**: Set working hours (start/end time) and days of the week.
- **Instructor Availability**: Manage instructor schedules and working hours.
- **Export**: Export your timetable to DOCX format.
- **Modern UI**: A sleek, responsive interface allowing for a premium user experience.

## Installation

You can download the latest installer for Windows from the release folder:

[Download Latest Installer (v1.0.0)](release/PersonaTable%20Setup%201.0.0.exe)

_Note: The installer is located in the `release/` directory of this repository._

## User Guide

### 1. Getting Started

- Launch **UniSchedule**.
- You can start fresh or click **"Load sample"** in the top navigation bar to populate the app with demo data to see how it works.

### 2. Managing Courses

- Navigate to the **Courses** section.
- Click **"Add"** to create a new course. Enter the course title, code, and other details.
- Use the **Search** bar to quickly find existing courses.
- Use **"Smart sort"** to organize your course list automatically.

### 3. Setting Constraints

- In the **Settings** panel (Week & hours), configure your available time:
  - **Start/End Hour**: Define the daily time range for classes.
  - **Weekdays**: Select which days of the week are available for scheduling.
- Click **"Apply"** to save these settings.

### 4. Managing Instructors

- Go to the **Instructors** section.
- Click **"Add"** to register a new instructor.
- Select an instructor from the dropdown to **Edit availability**.
- You can block out specific times or **"Set working hours"** for each instructor to ensure realistic scheduling.

### 5. Generating the Timetable

- Once courses and constraints are set, look for the **Generated timetable** section.
- Click the **"Generate"** button (or press `G`).
- The algorithm will attempt to create a conflict-free schedule based on your inputs.
- If successful, the timetable will be displayed visually.

### 6. Exporting

- Satisfied with the result? Click **"Export DOCX"** in the top bar to download your schedule as a Word document.
- You can also click **"Save"** to persist your current session data.

## Future Plans

- **Cloud Sync**: Save and access schedules across multiple devices.
- **Student Portal**: Allow students to view their personalized schedules.
- **Exam Scheduling**: Dedicated module for planning examination dates and venues.
- **Advanced Analytics**: Insights into resource utilization and room occupancy.
- **Mobile App**: Native mobile application for iOS and Android.

## Credits

Designed & Developed by:

- **Nohan Baloch**
- **Rafay Ahmed Memon**

&copy; 2026 UniSchedule. All rights reserved.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

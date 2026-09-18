# Community and Rating System Component

Youth Employment & Local Gig Board

Project Topic: Youth Employment & Local Gig Board – Local businesses and youth co-build a trusted community hiring pool

Component: Community and Rating System

---

# 1. Component Overview

The Community and Rating System component focuses on creating a trusted reputation system between youth workers and local businesses on the Youth Employment & Local Gig Board.

The main purpose of this component is to allow users to provide feedback after completing a gig and use that feedback to help other users make better decisions when choosing a youth worker or business.

The system will support mutual ratings, meaning both sides of a completed gig can rate each other:

- Youth Worker → Business
- Business → Youth Worker

The rating system will not depend only on a simple star rating. Users will also be able to select specific review categories and provide written feedback. The resulting ratings and reviews will then be displayed on user profiles so that other users can understand their reputation, reliability, and previous work experience.

Therefore, my component will focus on five main areas:

1. Rating a completed gig.
2. Mutual rating between youth workers and businesses.
3. Review categories.
4. Written reviews.
5. Displaying ratings and reviews on profiles.

---

# 2. Main Objectives

The main objectives of this component are:

- Create a trustworthy reputation system for the platform.
- Allow users to rate each other after completing gigs.
- Support fair and mutual evaluation between youth workers and businesses.
- Provide different rating criteria for youth workers and businesses.
- Make ratings more meaningful through specific review categories.
- Allow users to explain their experiences through written reviews.
- Display reputation information clearly on user profiles.
- Help users evaluate potential workers or businesses before accepting or offering a gig.
- Encourage professional, reliable, and fair behaviour within the gig community.

---

# 3. Target Users

The component supports two main user types.

## 3.1 Youth Workers

Youth workers will be able to:

- Rate businesses after completing gigs.
- Select appropriate rating categories.
- Write reviews about businesses.
- View their own ratings and reviews.
- View ratings and reviews of businesses.
- Use rating information to evaluate businesses before accepting future gigs.

## 3.2 Local Businesses

Businesses will be able to:

- Rate youth workers after completing gigs.
- Select appropriate rating categories.
- Write reviews about youth workers.
- View their own ratings and reviews.
- View ratings and reviews of youth workers.
- Use rating information when selecting youth workers for future gigs.

---

# 4. Task 1 – Rating a Completed Gig

## Purpose

After a gig has been successfully completed, the user should have the opportunity to provide feedback about the other party.

This creates a record of the user's experience and helps build trust within the community.

## What I Will Design

I will design a Rating a Completed Gig screen containing:

- Completed gig information.
- Name and profile picture of the person/business being rated.
- Gig title.
- Relevant gig information.
- 1–5 star rating control.
- Rating categories.
- Written review field.
- Submit button.

## Youth Worker Rating a Business

A youth worker can rate a business based on factors such as:

- Fair payment.
- Clear job description.
- Communication.
- Respectful treatment.
- Payment on time.
- Safe working environment.

## Business Rating a Youth Worker

A business can rate a youth worker based on:

- Work quality.
- Punctuality.
- Communication.
- Professionalism.
- Reliability.
- Ability to follow instructions.

## User Flow

Completed Gig → Rate Other Party → Select Star Rating → Select Categories → Write Review → Submit → Confirmation

The rating process should clearly identify the completed gig and the person or business being rated.

---

# 5. Task 2 – Mutual Rating System

## Purpose

The platform will use a mutual rating system, where both sides of a completed gig can provide feedback.

This is important because the platform should be fair to both youth workers and businesses.

Instead of allowing only businesses to evaluate workers, both parties will have an opportunity to build their reputation.

## Rating Direction

### Youth Worker → Business

The youth worker can evaluate the business based on:

- Fair payment.
- Clear instructions.
- Communication.
- Respectful treatment.
- Safe working environment.

### Business → Youth Worker

The business can evaluate the youth worker based on:

- Work quality.
- Punctuality.
- Communication.
- Professionalism.
- Reliability.
- Ability to follow instructions.

## What I Will Design

The interface will display the correct rating action based on the user's role.

### For a Youth Worker

#### Rate Business

The system will display categories related to the business.

### For a Business

#### Rate Worker

The system will display categories related to the youth worker.

The interface should clearly identify the person or business being rated and the completed gig associated with the rating.

---

# 6. Task 3 – Review Categories

## Purpose

A star rating alone does not provide enough information about someone's performance.

Review categories will allow users to explain what specifically went well or poorly during the completed gig.

This makes the rating information more useful for future decisions.

## Business Review Categories

When a youth worker rates a business, the categories can include:

- Fair Payment.
- Clear Job Description.
- Communication.
- Respectful Treatment.
- Payment on Time.
- Safe Working Environment.

## Youth Worker Review Categories

When a business rates a youth worker, the categories can include:

- Work Quality.
- Punctuality.
- Communication.
- Professionalism.
- Reliability.
- Ability to Follow Instructions.

## What I Will Design

I will use simple interactive elements such as:

- Selection tags.
- Chips.
- Checkboxes.
- Selection lists.

The number of categories will be kept manageable so that the rating process does not become too lengthy.

The categories displayed will change according to whether the user is rating a business or a youth worker.

---

# 7. Task 4 – Written Reviews

## Purpose

Written reviews allow users to explain their experience in more detail.

A star rating can show whether a user had a positive or negative experience, but a written review can explain why.

## What I Will Design

The written review section will contain:

- Review text box.
- Character counter if required.
- Short review guidance.
- Submit button.

Users will be encouraged to provide useful and relevant feedback based on the completed gig.

## Example – Youth Worker Reviewing Business

"The business provided clear instructions and paid the agreed amount on time. Communication was also good throughout the project."

## Example – Business Reviewing Youth Worker

"Nuwan completed the photography work on time and communicated well throughout the project."

## Review Requirements

The review interface should:

- Allow users to enter a short review.
- Prevent empty submissions where a written review is required.
- Provide a reasonable character limit if necessary.
- Encourage users to provide relevant work-related feedback.
- Keep the review process simple and easy to complete.

---

# 8. Task 5 – Displaying Ratings on Profiles

## Purpose

The rating and review information should be displayed on youth worker and business profiles.

This allows users to evaluate someone's reputation before deciding whether to work with them.

The rating information will act as a trust indicator within the community.

## What I Will Design

The profile rating section can display:

- Average star rating.
- Total number of reviews.
- Number of completed gigs.
- Recent reviews.
- Rating categories.
- Completed-gig/verified indicator where applicable.

## Example – Business Profile

⭐

# 18 completed gig reviews

## Common feedback:

- Fair payment
- Good communication
- Clear job requirements

## Example – Youth Worker Profile

⭐

# 12 completed gig reviews

## Common feedback:

- High-quality work
- Punctual
- Professional
- Reliable

## Collaboration with Profile Management

This part of the component will be coordinated with Member 1, who is responsible for User and Profile Management.

My responsibility will be to define:

- What rating information should appear.
- Where the rating information should appear.
- How the average rating should be displayed.
- How users can access detailed reviews.
- How completed-gig reputation should be presented.

The final profile design should integrate the rating information naturally without making the profile too crowded.

---

# 9. Overall Rating System User Flows

## 9.1 Youth Worker Rates a Business

Completed Gig

↓

Gig Details

↓

Rate Business

↓

Select 1–5 Star Rating

↓

Select Review Categories

↓

Write Review

↓

Submit Rating

↓

Confirmation

## 9.2 Business Rates a Youth Worker

Completed Gig

↓

Gig Details

↓

Rate Worker

↓

Select 1–5 Star Rating

↓

Select Review Categories

↓

Write Review

↓

Submit Rating

↓

Confirmation

## 9.3 User Views Reputation

User Profile

↓

Rating Summary

↓

Average Star Rating

↓

Number of Reviews

↓

Rating Categories

↓

Recent Reviews

↓

Evaluate Reputation

---

# 10. Main Screens I Will Design

| No. | Screen | Purpose |
|:---|:---|:---|
| 1 | Completed Gig/Rating Prompt | Provide access to the rating process after a gig is completed |
| 2 | Rate Business | Allow youth workers to rate businesses |
| 3 | Rate Worker | Allow businesses to rate youth workers |
| 4 | Rating Categories | Allow users to select detailed feedback categories |
| 5 6 | Written Review | Allow users to write additional feedback |
| 7 | Profile Rating Summary | Display average rating and reputation |
| 8 | Reviews Section | Display written reviews and category feedback |

Some screens may be combined depending on the final prototype and UI design.

---

# 11. UX Design Principles

The component will follow the overall design system of the project and focus on the following principles.

## Simplicity

The rating process should be quick and should not require unnecessary steps.

## Clarity

Users should clearly understand who they are rating and what they are rating them for.

## Transparency

Ratings should be connected to completed gigs so that users can understand the context of the feedback.

## Consistency

The rating interface should follow the same UI patterns used throughout the platform.

## Feedback

Users should receive clear confirmation after submitting a rating or review.

## Error Prevention

The interface should prevent users from accidentally rating the wrong person or submitting incomplete ratings.

## Trust

The rating system should provide useful information based on actual completed-gig experience.

---

# 12. Component Deliverables

The final deliverables for my component will include:

1. Rating Screens: Designs for rating a completed gig from both the youth worker and business perspectives.
2. Mutual Rating Flow: A user flow demonstrating how the system changes depending on whether the user is a youth worker or business.
3. Review Category Design: A set of appropriate rating categories for both sides of the marketplace.
4. Written Review Interface: A simple interface for users to provide detailed feedback.
5. Profile Reputation Section: A design showing how average ratings, review counts, categories, and reviews will appear on profiles.
6. Interactive Prototype: An interactive prototype demonstrating the complete rating and review experience.

---

# 13. Scope of My Component

## Included

- Rating completed gigs.
- 1–5 star ratings.
- Mutual rating system.
- Business rating categories.
- Youth worker rating categories.
- Written reviews.
- Review validation.
- Rating confirmation.
- Profile rating summary.
- Displaying reviews on profiles.
- Displaying rating categories on profiles.
- Completed-gig reputation information.
- Interactive prototype of the rating and review flow.

## Not Included

- Community feed.
- Creating community posts.
- Comments and replies.
- Community guidelines.
- Social features.

These features will be handled by other components/members of the project.

---

# 14. Expected Outcome

The final prototype for the Community and Rating System should demonstrate how the Youth Employment & Local Gig Board can create a trusted hiring environment between youth workers and local businesses.

The component will provide a complete reputation cycle:

Completed Gig → Mutual Rating → Review Categories → Written Review → Profile Reputation

The system will allow both sides of the marketplace to build a reputation based on their actual completed-gig history.

The final design should make the rating and review process:

- Simple
- Fair
- Transparent
- Trustworthy
- Easy to understand
- Useful for future hiring decisions

The main goal of this component is to help youth workers and local businesses make safer and more informed decisions when choosing who to work with.

## Core Concept

Complete a Gig → Rate Each Other → Explain the Experience → Build Reputation → Make Better Future Hiring Decisions

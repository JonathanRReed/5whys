/**
 * The interview question bank. Every question says who it suits, what a
 * strong answer shows, and one common mistake; the rehearsal room shows both
 * notes beside the question. Ids never change: saved stories and packets
 * refer to them. Text may be reworded.
 */

import type { Audience } from './audience';
import { SKILL_MAP } from './skills';

export interface QuestionPrompt {
  id: string;
  text: string;
  skillIds: string[]; // Can apply to multiple skills
  category: 'behavioral' | 'technical' | 'situational' | 'general';
  /** Who this question suits. */
  audiences: readonly Audience[];
  /** What a strong answer shows, in one line. */
  strongAnswer: string;
  /** One mistake people often make with this question. */
  commonMistake: string;
  /**
   * The posting must name one of these skills before the question is
   * offered. Technical questions default to their technical skills.
   */
  onlyFor?: readonly string[];
  /** What an interviewer tends to ask next. Used for questions that are not a story. */
  followUps?: readonly string[];
}

const ALL: readonly Audience[] = ['student', 'early-career', 'experienced', 'career-changer'];
const WORKING: readonly Audience[] = ['early-career', 'experienced', 'career-changer'];
const STUDENT: readonly Audience[] = ['student'];
const STUDENT_EARLY: readonly Audience[] = ['student', 'early-career'];
const CHANGER: readonly Audience[] = ['career-changer'];
const SEASONED: readonly Audience[] = ['experienced', 'career-changer'];

/**
 * Questions about the terms of a job rather than a story: asked in the
 * rehearsal room only when the posting has a work-authorization line, or
 * when the visitor adds them. They carry no skill, so they never show up as
 * story questions.
 */
export const WORK_AUTHORIZATION_QUESTION_ID = 'q-work-authorization';
export const SALARY_QUESTION_ID = 'q-salary-expectations';
export const TERMS_QUESTION_IDS = [WORK_AUTHORIZATION_QUESTION_ID, SALARY_QUESTION_ID] as const;

export const QUESTION_BANK: QuestionPrompt[] = [
  // General Questions
  {
    id: 'q-intro',
    text: 'Tell me about yourself.',
    skillIds: ['general'],
    category: 'general',
    audiences: ALL,
    strongAnswer:
      'A short path from where you have been to why this role is the next step, with one example that fits the posting.',
    commonMistake: 'Reciting your whole history, or your personal life, with no point at the end.',
    followUps: [
      'What made you apply for this role in particular?',
      'Which part of that are you proudest of?',
    ],
  },
  {
    id: WORK_AUTHORIZATION_QUESTION_ID,
    text: 'Will you now or in the future require sponsorship to work in this role?',
    skillIds: [],
    category: 'general',
    audiences: ALL,
    strongAnswer:
      "A truthful, brief answer, then a return to why you fit the role. Know what your status allows before the interview by asking your school's international student office.",
    commonMistake:
      "Guessing about what your status allows instead of asking your school's international student office before the interview.",
  },
  {
    id: SALARY_QUESTION_ID,
    text: 'What are your salary expectations?',
    skillIds: [],
    category: 'general',
    audiences: ALL,
    strongAnswer:
      'A range you looked up for this kind of role in this place, said plainly, and openness to talking about the whole offer.',
    commonMistake:
      'Naming a number you have not looked up, or saying any amount is fine before you know what the job pays.',
  },
  {
    id: 'q-why-company',
    text: 'Why do you want to work here?',
    skillIds: ['general'],
    category: 'general',
    audiences: ALL,
    strongAnswer:
      'Something specific about this employer that you found yourself, tied to what you want to do.',
    commonMistake: 'Praise that would fit any employer, such as "great culture".',
    followUps: ['What do you know about the people you would be working with?'],
  },
  {
    id: 'q-why-role',
    text: 'Why are you interested in this role?',
    skillIds: ['general'],
    category: 'general',
    audiences: ALL,
    strongAnswer:
      'Two or three parts of the job you want to do, each linked to something you have already done.',
    commonMistake: 'Talking about what the job gives you rather than the work itself.',
    followUps: ['Which part of the job would be new to you?'],
  },
  {
    id: 'q-strengths',
    text: 'What are your greatest strengths?',
    skillIds: ['general'],
    category: 'general',
    audiences: ALL,
    strongAnswer: 'One or two strengths the posting asks for, each with a short example.',
    commonMistake: 'A list of adjectives with nothing to back them up.',
    followUps: ['Can you give me one example of that?'],
  },
  {
    id: 'q-weaknesses',
    text: 'What is your biggest weakness?',
    skillIds: ['general'],
    category: 'general',
    audiences: ALL,
    strongAnswer: 'A real weakness that does not sink the job, and what you are doing about it.',
    commonMistake: 'A strength in disguise, such as "I work too hard".',
    followUps: ['How do you know it is getting better?'],
  },
  {
    id: 'q-five-years',
    text: 'Where do you see yourself in five years?',
    skillIds: ['general'],
    category: 'general',
    audiences: ALL,
    strongAnswer: 'A direction that this role helps you move in, said without a fixed title.',
    commonMistake: 'Naming a job that would mean leaving this one quickly.',
    followUps: ['What would you need to learn here to get there?'],
  },

  // Student and early-career staples
  {
    id: 'q-stu-resume',
    text: 'Walk me through your resume.',
    skillIds: ['general'],
    category: 'general',
    audiences: ALL,
    strongAnswer:
      'The two or three entries that matter most for this role, in order, with what each taught you.',
    commonMistake: 'Reading every line aloud.',
    followUps: ['Which of those would you want to talk about more?'],
  },
  {
    id: 'q-stu-no-exp',
    text: "You don't have industry experience. Why should we hire you?",
    skillIds: ['general'],
    category: 'general',
    audiences: STUDENT,
    strongAnswer:
      'Proof from school, a campus job, or a club that you can already do part of this work.',
    commonMistake: 'Apologizing for being a student.',
    followUps: ['What would you need help with in the first month?'],
  },
  {
    id: 'q-stu-major',
    text: 'Why did you choose your major?',
    skillIds: ['general'],
    category: 'general',
    audiences: STUDENT_EARLY,
    strongAnswer: 'An honest reason, and how it connects to this kind of work.',
    commonMistake: 'Pretending you planned everything from the start.',
    followUps: ['Which class has been most useful outside the classroom?'],
  },
  {
    id: 'q-stu-class-project',
    text: "Tell me about a class project you're proud of. What was your specific contribution?",
    skillIds: ['ownership', 'teamwork'],
    category: 'behavioral',
    audiences: STUDENT_EARLY,
    strongAnswer: 'The part you did yourself, a decision you made, and how the project turned out.',
    commonMistake: 'Describing the whole group\'s work as "we" so your part disappears.',
  },
  {
    id: 'q-stu-group-conflict',
    text: 'Tell me about a group project where a teammate was not pulling their weight. What did you do?',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
    audiences: STUDENT,
    strongAnswer: 'You talked to them directly and early, and you kept the project moving.',
    commonMistake: 'Spending the answer on how bad the teammate was.',
  },
  {
    id: 'q-stu-overwhelmed',
    text: 'Tell me about a time coursework got overwhelming. How did you get through it?',
    skillIds: ['time-management', 'adaptability'],
    category: 'behavioral',
    audiences: STUDENT,
    strongAnswer: 'How you decided what came first, and what you changed so it did not repeat.',
    commonMistake: 'Saying you never get overwhelmed.',
  },
  {
    id: 'q-stu-balance',
    text: 'How did you balance school with work, clubs, or other commitments?',
    skillIds: ['time-management'],
    category: 'behavioral',
    audiences: STUDENT,
    strongAnswer: 'A real week, the system you used, and one thing you had to give up.',
    commonMistake: 'Listing commitments without saying how you managed them.',
  },
  {
    id: 'q-stu-internship',
    text: 'What did you learn during your internship that you could not have learned in class?',
    skillIds: ['adaptability', 'general'],
    category: 'behavioral',
    audiences: STUDENT_EARLY,
    strongAnswer: 'One specific lesson from real work and how it changed what you do now.',
    commonMistake: 'A general answer such as "teamwork" with no example.',
  },
  {
    id: 'q-stu-club',
    text: 'Tell me about something you organized or led in a club or student organization.',
    skillIds: ['leadership', 'ownership'],
    category: 'behavioral',
    audiences: STUDENT,
    strongAnswer: 'What you organized, the people involved, and how it went.',
    commonMistake: 'Leading with your title instead of what you did.',
  },
  {
    id: 'q-stu-parttime',
    text: 'What did your part-time job teach you about working with people?',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
    audiences: STUDENT_EARLY,
    strongAnswer: 'One moment with a customer or coworker and what you learned from it.',
    commonMistake: 'Treating a part-time job as not worth talking about.',
  },
  {
    id: 'q-stu-course',
    text: 'Which course challenged you the most, and how did you handle it?',
    skillIds: ['adaptability', 'problem-solving'],
    category: 'behavioral',
    audiences: STUDENT,
    strongAnswer: 'What made it hard, what you changed in how you studied, and the result.',
    commonMistake: 'Blaming the professor.',
  },
  {
    id: 'q-stu-feedback',
    text: 'Tell me about a time you got tough feedback from a professor or manager. What did you change?',
    skillIds: ['adaptability', 'communication'],
    category: 'behavioral',
    audiences: STUDENT_EARLY,
    strongAnswer: 'The feedback in plain words, how you took it, and what you did differently.',
    commonMistake: 'Choosing feedback that was not really tough.',
  },
  {
    id: 'q-stu-teach',
    text: 'Describe a time you tutored or taught someone. How did you know it worked?',
    skillIds: ['communication', 'leadership'],
    category: 'behavioral',
    audiences: STUDENT_EARLY,
    strongAnswer: 'How you checked they understood, not only that you explained it.',
    commonMistake: 'Describing what you said instead of what they could do afterward.',
  },

  // Leadership
  {
    id: 'q-lead-project',
    text: 'Tell me about a time you led a project.',
    skillIds: ['leadership', 'ownership'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'How you set the plan, kept people on track, and what came of it.',
    commonMistake: 'Describing the project without saying what leading it involved.',
  },
  {
    id: 'q-lead-conflict',
    text: 'How do you handle conflict within your team?',
    skillIds: ['leadership', 'communication'],
    category: 'behavioral',
    audiences: WORKING,
    strongAnswer: 'One real conflict, how you brought it into the open, and how it ended.',
    commonMistake: 'Answering in general terms with no example.',
  },
  {
    id: 'q-lead-mentor',
    text: 'Describe a time you mentored someone.',
    skillIds: ['leadership', 'teamwork'],
    category: 'behavioral',
    audiences: WORKING,
    strongAnswer: 'What they could not do before, what you did, and what they could do after.',
    commonMistake: 'Making the story about you rather than their progress.',
  },
  {
    id: 'q-lead-decision',
    text: 'Tell me about a difficult decision you had to make as a leader.',
    skillIds: ['leadership', 'problem-solving'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'The options, what you weighed, what you chose, and how you explained it.',
    commonMistake: 'Choosing a decision with an obvious answer.',
  },

  // Problem Solving
  {
    id: 'q-ps-complex',
    text: 'Describe a complex problem you solved.',
    skillIds: ['problem-solving'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'How you found the cause, not only the fix, and how you knew it was solved.',
    commonMistake: 'Explaining the problem in so much detail there is no time for your part.',
  },
  {
    id: 'q-ps-debug',
    text: 'Walk me through how you debug a production issue.',
    skillIds: ['problem-solving', 'backend'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'Clear steps: reproduce, narrow down, fix, and make sure it stays fixed.',
    commonMistake: 'Jumping to the fix without saying how you found the cause.',
  },
  {
    id: 'q-ps-tradeoff',
    text: 'Tell me about a time you had to make a tradeoff.',
    skillIds: ['problem-solving', 'product'],
    category: 'situational',
    audiences: WORKING,
    strongAnswer: 'What you gave up, what you kept, and why that was the right call then.',
    commonMistake: 'Pretending there was no cost.',
  },
  {
    id: 'q-ps-ambiguity',
    text: 'How do you handle ambiguous requirements?',
    skillIds: ['problem-solving', 'adaptability'],
    category: 'situational',
    audiences: WORKING,
    strongAnswer: 'The questions you ask first, and how you move ahead while you wait for answers.',
    commonMistake: 'Saying you wait until someone tells you exactly what to do.',
  },

  // Communication
  {
    id: 'q-comm-bad-news',
    text: 'Tell me about a time you had to give someone news they did not want to hear.',
    skillIds: ['communication'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'You said it early and plainly, and came with a next step.',
    commonMistake: 'Telling it so the other person comes off badly.',
  },
  {
    id: 'q-comm-written',
    text: 'Tell me about something you have written that other people relied on. How did you make it clear?',
    skillIds: ['communication'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer:
      'Who read it, what they needed from it, and one choice you made to keep it clear.',
    commonMistake: 'Describing the topic instead of how you wrote it.',
  },
  {
    id: 'q-comm-present',
    text: 'Tell me about a time you presented findings or a plan to people outside your team. How did you make it land?',
    skillIds: ['communication'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'Who was listening, what they needed to decide, and how you shaped it for them.',
    commonMistake: 'Describing the slides instead of the audience.',
  },
  {
    id: 'q-comm-explain',
    text: 'Explain something complicated from your work or studies to someone outside it.',
    skillIds: ['communication'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer:
      'Plain words, one comparison the listener already knows, and a check that it landed.',
    commonMistake: 'Using the same terms you would use with an expert.',
  },
  {
    id: 'q-comm-disagree',
    text: 'Tell me about a time you disagreed with a stakeholder.',
    skillIds: ['communication', 'leadership'],
    category: 'behavioral',
    audiences: WORKING,
    strongAnswer: 'How you made your case with facts, listened, and what was decided.',
    commonMistake: 'A story where you were simply right and they were wrong.',
  },
  {
    id: 'q-comm-feedback',
    text: 'How do you give and receive feedback?',
    skillIds: ['communication', 'teamwork'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'One time you gave feedback and one time you took it, with what changed.',
    commonMistake: 'Describing a method with no example.',
  },

  // Teamwork
  {
    id: 'q-team-collab',
    text: 'Describe a successful cross-functional collaboration.',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
    audiences: WORKING,
    strongAnswer: 'What each group needed, how you kept them talking, and the result.',
    commonMistake: 'Listing the teams without saying what you did between them.',
  },
  {
    id: 'q-team-difficult',
    text: 'Tell me about a time you worked with a difficult teammate.',
    skillIds: ['teamwork', 'adaptability'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'What you did to make it work, and what you understood about them afterward.',
    commonMistake: 'Complaining about the person.',
  },
  {
    id: 'q-team-remote',
    text: 'How do you collaborate with remote team members?',
    skillIds: ['teamwork', 'communication'],
    category: 'situational',
    audiences: WORKING,
    strongAnswer: 'The habits you keep so nothing gets lost, with one example.',
    commonMistake: 'Naming tools instead of habits.',
  },

  // Ownership
  {
    id: 'q-own-initiative',
    text: 'Tell me about a time you took initiative beyond your role.',
    skillIds: ['ownership'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'What you noticed, why you acted without being asked, and what it changed.',
    commonMistake: 'Choosing something that was part of your job anyway.',
  },
  {
    id: 'q-own-failure',
    text: 'Describe a project that failed. What did you learn?',
    skillIds: ['ownership', 'problem-solving'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'Your share of what went wrong and what you do differently now.',
    commonMistake: "A failure that was entirely someone else's fault.",
  },
  {
    id: 'q-own-improve',
    text: 'Tell me about a process you improved.',
    skillIds: ['ownership', 'problem-solving'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'How it worked before, what you changed, and how you know it was better.',
    commonMistake: 'Leaving out how you got other people to use the new way.',
  },

  // Adaptability
  {
    id: 'q-adapt-change',
    text: 'Describe a time requirements changed mid-project.',
    skillIds: ['adaptability', 'agile'],
    category: 'situational',
    audiences: WORKING,
    strongAnswer: 'What changed, how you replanned, and what you told the people affected.',
    commonMistake: 'Only complaining about the change.',
  },
  {
    id: 'q-adapt-learn',
    text: 'Tell me about a time you had to learn something quickly.',
    skillIds: ['adaptability'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'How you learned it and how soon you could use it.',
    commonMistake: 'Saying you learn fast without showing how.',
  },
  {
    id: 'q-adapt-pressure',
    text: 'How do you perform under pressure?',
    skillIds: ['adaptability', 'time-management'],
    category: 'situational',
    audiences: ALL,
    strongAnswer: 'One real high-pressure moment and what you did step by step.',
    commonMistake: 'Saying you thrive under pressure and stopping there.',
  },

  // Time Management
  {
    id: 'q-time-priority',
    text: 'How do you prioritize competing deadlines?',
    skillIds: ['time-management'],
    category: 'situational',
    audiences: ALL,
    strongAnswer: 'How you decide what comes first and who you tell when something has to slip.',
    commonMistake: 'Describing a to-do app instead of how you decide.',
  },
  {
    id: 'q-time-missed',
    text: 'Tell me about a time you missed a deadline. What happened?',
    skillIds: ['time-management', 'ownership'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'Owning the miss, warning people early, and what you changed after.',
    commonMistake: 'Choosing a miss that was not your doing.',
  },

  // Attention to Detail
  {
    id: 'q-detail-catch',
    text: 'Tell me about a time you caught a mistake everyone else missed.',
    skillIds: ['attention-to-detail'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'How you spotted it, what it would have cost, and how you raised it.',
    commonMistake: 'Making others look careless.',
  },
  {
    id: 'q-detail-process',
    text: 'What is your process for checking work before you call it done?',
    skillIds: ['attention-to-detail', 'ownership'],
    category: 'situational',
    audiences: ALL,
    strongAnswer: 'The actual steps you take, and one time they caught something.',
    commonMistake: 'Saying "I double-check" with nothing more.',
  },

  // Python
  {
    id: 'q-py-project',
    text: 'Walk me through a Python project you have built. What did it do, and what was the hardest part?',
    skillIds: ['python', 'problem-solving'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'What it did, the hard part, and how you solved it, in plain language first.',
    commonMistake: 'Listing libraries without explaining the problem.',
  },
  {
    id: 'q-py-quality',
    text: 'How do you keep a growing Python codebase readable and tested?',
    skillIds: ['python', 'attention-to-detail'],
    category: 'technical',
    audiences: WORKING,
    strongAnswer:
      'The habits you keep, such as tests and reviews, and one time they caught a problem.',
    commonMistake: 'Naming tools without saying how you use them.',
  },

  // JavaScript
  {
    id: 'q-js-build',
    text: 'Tell me about something you built with JavaScript or a framework like React. What broke first, and how did you fix it?',
    skillIds: ['javascript', 'frontend'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'A real bug, how you tracked it down, and what you learned.',
    commonMistake: 'Describing the feature list instead of the problem.',
  },
  {
    id: 'q-js-async',
    text: 'How have you handled asynchronous code or API calls in JavaScript? Give a concrete example.',
    skillIds: ['javascript', 'api'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'A concrete case, including what you did when a call failed or was slow.',
    commonMistake: 'Reciting definitions without an example.',
  },

  // Java
  {
    id: 'q-java-design',
    text: 'Describe a Java project you have worked on. How did you decide how to structure the classes?',
    skillIds: ['java', 'backend'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'The structure you chose and the reason, including one thing you would change.',
    commonMistake: 'Listing patterns by name without saying why.',
  },

  // SQL/Databases
  {
    id: 'q-sql-question',
    text: 'Tell me about a time you used SQL to answer a real question. What did the query need to find?',
    skillIds: ['sql', 'data-analysis'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'The question in plain words, how the query answered it, and what was decided.',
    commonMistake: 'Describing syntax instead of the question.',
  },
  {
    id: 'q-sql-slow',
    text: 'A query is slow. Walk me through how you would find out why and speed it up.',
    skillIds: ['sql', 'problem-solving'],
    category: 'technical',
    audiences: WORKING,
    strongAnswer: 'Measure first, find the cause, change one thing, and measure again.',
    commonMistake: 'Guessing at a fix before looking at the cause.',
  },

  // Machine Learning
  {
    id: 'q-ml-endtoend',
    text: 'Walk me through a machine learning project end to end: the data, the model, and how you evaluated it.',
    skillIds: ['ml', 'data-analysis'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'Where the data came from, why you chose the model, and how you judged it.',
    commonMistake: 'Spending the answer on the model and none on the data.',
  },
  {
    id: 'q-ml-overfit',
    text: 'How do you tell when a model is overfitting, and what have you actually done about it?',
    skillIds: ['ml'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'The sign you saw, and the change you made in a real project.',
    commonMistake: 'A textbook definition with no example.',
  },

  // Security
  {
    id: 'q-sec-risk',
    text: 'Tell me about a security risk or vulnerability you found. What did you do next?',
    skillIds: ['security', 'attention-to-detail'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'How you found it, who you told, and how it was fixed.',
    commonMistake: 'Skipping how you reported it.',
  },
  {
    id: 'q-sec-explain',
    text: 'Explain a common attack, like SQL injection or phishing, to someone non-technical.',
    skillIds: ['security', 'communication'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'Plain words, an everyday comparison, and what a person can do about it.',
    commonMistake: 'Using jargon the listener would not know.',
  },

  // Frontend
  {
    id: 'q-fe-ui',
    text: 'Tell me about an interface you built. How did you handle responsiveness or accessibility?',
    skillIds: ['frontend', 'ux'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'Who used it, one problem on a small screen or for a screen reader, and the fix.',
    commonMistake: 'Describing how it looked instead of how it worked for people.',
  },
  {
    id: 'q-fe-perf',
    text: 'A page loads slowly. What do you check first?',
    skillIds: ['frontend', 'problem-solving'],
    category: 'technical',
    audiences: WORKING,
    strongAnswer: 'Measure first, then the likely causes in order.',
    commonMistake: 'Guessing at a fix before measuring.',
  },

  // Mobile
  {
    id: 'q-mob-app',
    text: 'Describe a mobile app you have built or contributed to. What platform constraint surprised you?',
    skillIds: ['mobile'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'Your part, the constraint, and how you worked around it.',
    commonMistake: 'Describing the app store listing instead of the work.',
  },

  // Data Analysis
  {
    id: 'q-data-decision',
    text: 'Tell me about a time your analysis changed a decision. What did you find?',
    skillIds: ['data-analysis', 'communication'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'What you looked at, what you found, and who acted on it.',
    commonMistake: 'Describing the spreadsheet instead of the decision.',
  },
  {
    id: 'q-data-messy',
    text: 'You get a messy dataset. Walk me through how you would clean and sanity-check it.',
    skillIds: ['data-analysis', 'attention-to-detail'],
    category: 'technical',
    audiences: ALL,
    strongAnswer: 'The checks you run first, and how you note what you changed.',
    commonMistake: 'Fixing data silently without recording what changed.',
  },

  // UX
  {
    id: 'q-ux-feedback',
    text: 'Tell me about a time user feedback changed your design.',
    skillIds: ['ux', 'adaptability'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'What you heard, what you changed, and how you checked it worked.',
    commonMistake: 'Feedback you ignored, told as if you listened.',
    onlyFor: ['ux', 'product', 'frontend'],
  },
  {
    id: 'q-ux-research',
    text: 'How do you decide what to test with users, and what did you learn the last time you did?',
    skillIds: ['ux', 'product'],
    category: 'situational',
    audiences: ALL,
    strongAnswer: 'How you chose the question, who you asked, and what you learned.',
    commonMistake: 'Describing a method without a real result.',
    onlyFor: ['ux', 'product'],
  },

  // Finance
  {
    id: 'q-fin-accuracy',
    text: 'When the numbers have to be exactly right, how do you check your work? Give me an example.',
    skillIds: ['finance', 'attention-to-detail'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'The checks you run, and one time they caught an error.',
    commonMistake: 'Saying "I am very careful" with no method.',
  },

  // Healthcare
  {
    id: 'q-health-sensitive',
    text: 'Tell me about a time you handled sensitive or regulated data. What rules did you have to follow?',
    skillIds: ['healthcare', 'security'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'The rule, what it meant day to day, and one time it mattered.',
    commonMistake: 'Sharing details you were supposed to keep private.',
    onlyFor: ['healthcare', 'security', 'finance'],
  },

  // E-commerce
  {
    id: 'q-ecom-funnel',
    text: 'Describe a time you improved a customer-facing flow. How did you measure whether it worked?',
    skillIds: ['ecommerce', 'data-analysis'],
    category: 'behavioral',
    audiences: ALL,
    strongAnswer: 'What customers struggled with, what you changed, and what you counted after.',
    commonMistake: 'Claiming a result you did not measure.',
    onlyFor: ['ecommerce', 'ux', 'product'],
  },

  // Technical - General
  {
    id: 'q-tech-design',
    text: 'Walk me through a system you designed.',
    skillIds: ['backend', 'api', 'cloud'],
    category: 'technical',
    audiences: WORKING,
    strongAnswer: 'The problem, the main parts, and one tradeoff you made on purpose.',
    commonMistake: 'Drawing every box without saying why.',
  },
  {
    id: 'q-tech-scale',
    text: 'How would you handle a service suddenly getting far more traffic than it was built for?',
    skillIds: ['backend', 'cloud', 'devops'],
    category: 'technical',
    audiences: WORKING,
    strongAnswer: 'Find the part that breaks first, then the change that relieves it.',
    commonMistake: 'Listing technologies instead of reasoning about the bottleneck.',
  },
  {
    id: 'q-tech-learn',
    text: 'How do you keep up with changes in your field?',
    skillIds: ['general'],
    category: 'behavioral',
    audiences: WORKING,
    strongAnswer: 'A habit you actually keep and one thing it taught you recently.',
    commonMistake: 'Naming sources you do not really follow.',
    followUps: ['What is something you changed your mind about recently?'],
  },

  // Career changers and people who were laid off
  {
    id: 'q-chg-why-change',
    text: 'Why are you moving from your last field into this one?',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'A reason that points forward, to what draws you to this work, and one thing you have already done about it.',
    commonMistake: 'Spending the answer on what was wrong with the old job.',
    followUps: [
      'What have you already done to prepare for this field?',
      'What will you miss about your last field?',
    ],
  },
  {
    id: 'q-chg-left-last-job',
    text: 'Tell me about leaving your last job.',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'One or two plain sentences on what happened, then a turn to what you want next. A layoff said plainly is not held against you.',
    commonMistake: 'Over-explaining, or sounding bitter about the employer.',
    followUps: [
      'What did you learn there that you would bring here?',
      'Would your last manager hire you again?',
    ],
  },
  {
    id: 'q-chg-gap',
    text: 'What have you been doing since your last role?',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'A short, honest account: the search itself, and anything you learned, practiced, or helped with.',
    commonMistake: 'Apologizing for the gap, or padding it with things you did not really do.',
    followUps: ['What have you learned about this field in that time?'],
  },
  {
    id: 'q-chg-transfer',
    text: 'Which parts of your past work carry over to this role?',
    skillIds: ['general', 'adaptability'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      "Two or three specific overlaps, each said in this field's words with an example from your old one.",
    commonMistake: 'Claiming everything transfers, so nothing stands out.',
    followUps: ['Which part of this job would be new to you?'],
  },
  {
    id: 'q-chg-lower-title',
    text: 'This role is a step down in title from your last one. Why does that work for you?',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'You understand the trade, the work matters more than the title for now, and you expect to learn here.',
    commonMistake: 'Hinting that you will be bored, or that you expect a quick promotion.',
    followUps: ['How would you feel taking direction on work you used to direct?'],
  },
  {
    id: 'q-chg-new-domain',
    text: 'How would you get up to speed on a field you have not worked in?',
    skillIds: ['adaptability'],
    category: 'situational',
    audiences: CHANGER,
    strongAnswer:
      'A concrete plan that starts from something you have already begun: a course, reading, or people you have talked to.',
    commonMistake: 'Saying you learn fast without showing how.',
  },
  {
    id: 'q-chg-learned-system',
    text: 'Tell me about a time you had to learn a new system or process at work.',
    skillIds: ['adaptability'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'The system, how you learned it, and when you could use it without help.',
    commonMistake: 'Describing the training you were given instead of what you did.',
  },
  {
    id: 'q-chg-different',
    text: 'What do you expect to be different about this work compared with your last job?',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'Proof you looked into it: you know what a normal day involves and can name a real difference.',
    commonMistake: 'Saying it will be about the same, or easier.',
    followUps: ['Who have you talked to who does this work now?'],
  },
  {
    id: 'q-chg-pay',
    text: 'This role may pay less than you made before. How do you feel about that?',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'You know the range for this kind of role and have a short reason it works for you.',
    commonMistake: 'Saying money does not matter, or naming a number before you have an offer.',
    followUps: ['What range are you looking for?'],
  },
  {
    id: 'q-chg-manager',
    text: 'You may report to someone with less experience than you. How would you handle that?',
    skillIds: ['teamwork'],
    category: 'situational',
    audiences: CHANGER,
    strongAnswer: 'Respect for what they know about this work, and how you would learn from them.',
    commonMistake: 'Implying you would know better.',
  },
  {
    id: 'q-chg-why-you',
    text: 'Other candidates have direct experience in this field. Why should we pick you?',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'What you bring that they may not, tied to the posting, and how you are closing the gap.',
    commonMistake: 'Arguing that experience does not matter.',
    followUps: ['What would you need help with in the first few months?'],
  },
  {
    id: 'q-chg-stay',
    text: 'How do we know you will not go back to your old field?',
    skillIds: ['general'],
    category: 'general',
    audiences: CHANGER,
    strongAnswer:
      'Signs the decision is settled: steps you have taken and reasons that will not change next month.',
    commonMistake: 'Saying you would go back if the right offer came along.',
    followUps: ['What would make you leave this job?'],
  },
  {
    id: 'q-chg-proud',
    text: 'What are you most proud of from your last job?',
    skillIds: ['general', 'ownership'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer:
      'A specific result you caused, told so the skill underneath is clear for this role.',
    commonMistake: 'A story that only makes sense inside your old industry.',
  },

  // Experienced candidates: the work itself
  {
    id: 'q-exp-manage-people',
    text: 'Tell me about managing a team. How did you get the work done through other people?',
    skillIds: ['leadership'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer:
      'How you set expectations, checked progress, and handled one person who needed more.',
    commonMistake: "Describing the team's results without your part in them.",
  },
  {
    id: 'q-exp-underperformer',
    text: 'Tell me about someone on your team who was not performing. What did you do?',
    skillIds: ['leadership', 'communication'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer:
      'An early, direct conversation, a clear plan, and follow-through, however it ended.',
    commonMistake: 'Waiting too long, or blaming the person without saying what you tried.',
  },
  {
    id: 'q-exp-hard-call',
    text: 'Tell me about a hard call you made without all the information you wanted.',
    skillIds: ['problem-solving', 'leadership'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'What you knew, what you did not, how you decided, and what happened.',
    commonMistake: 'Picking a decision that was not actually hard.',
  },
  {
    id: 'q-exp-unpopular',
    text: 'Tell me about a decision you made that your team did not like.',
    skillIds: ['leadership', 'communication'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'Why you made it, how you explained it, and what you did about the pushback.',
    commonMistake: 'Making the team sound unreasonable.',
  },
  {
    id: 'q-exp-process',
    text: 'Tell me about a process you changed. What was it like before and after?',
    skillIds: ['operations', 'ownership', 'problem-solving'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'The before, what you changed and why, and a result someone could check.',
    commonMistake: 'Leaving out how you got people to adopt the change.',
  },
  {
    id: 'q-exp-peer-conflict',
    text: 'Tell me about a conflict with a peer, not someone you managed. How did you work it out?',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer:
      'You went to them directly, listened, and found something you could both live with.',
    commonMistake: 'Telling it so you were right and they were wrong.',
  },
  {
    id: 'q-exp-missed-target',
    text: 'Tell me about a time you missed a target. What happened, and what did you change?',
    skillIds: ['ownership', 'operations'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'You own the miss, name the cause, and describe the change you made after.',
    commonMistake: "Choosing a miss that was someone else's fault.",
  },
  {
    id: 'q-exp-two-bosses',
    text: 'Tell me about a time two people above you wanted different things from you.',
    skillIds: ['communication', 'time-management'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'How you made the conflict visible and got a decision instead of guessing.',
    commonMistake: 'Quietly picking one side and hoping no one noticed.',
  },
  {
    id: 'q-exp-train',
    text: 'How do you train someone new so they can do the work without you?',
    skillIds: ['leadership', 'process-documentation'],
    category: 'situational',
    audiences: SEASONED,
    strongAnswer: 'The steps you take and how you know they are ready.',
    commonMistake: '"I just show them", with no structure.',
  },
  {
    id: 'q-exp-less',
    text: 'Tell me about a time you had to do the job with less money or fewer people than you wanted.',
    skillIds: ['problem-solving', 'budgeting'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'What you cut, what you protected, and why.',
    commonMistake: 'Complaining about the constraint.',
  },
  {
    id: 'q-exp-mistake',
    text: 'Tell me about a mistake you made at work that affected other people.',
    skillIds: ['ownership'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'You owned it quickly, fixed it, and changed something so it would not repeat.',
    commonMistake: 'A mistake with no real cost.',
  },
  {
    id: 'q-exp-no-authority',
    text: 'Tell me about a time you got something done without authority over the people involved.',
    skillIds: ['teamwork', 'communication'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'What they cared about, how you used that, and what got done.',
    commonMistake: 'Going over their heads and calling it influence.',
  },
  {
    id: 'q-exp-hard-customer',
    text: 'Tell me about the hardest customer or client problem you have handled.',
    skillIds: ['customer-service', 'problem-solving'],
    category: 'behavioral',
    audiences: WORKING,
    strongAnswer: 'What they needed, what you did, and how it ended for them.',
    commonMistake: 'Making the customer the villain.',
  },
  {
    id: 'q-exp-numbers',
    text: 'Which numbers did you track in your last role, and what did you do when one moved the wrong way?',
    skillIds: ['operations', 'data-analysis'],
    category: 'behavioral',
    audiences: SEASONED,
    strongAnswer: 'The numbers by name, and one time you acted on a change.',
    commonMistake: 'Listing numbers without showing you used them.',
  },
];

// Pre-indexed Map structures for O(1) Question Bank lookups instead of O(N) linear array searches
// during UI rendering and question resolution.
export const QUESTION_MAP = new Map<string, QuestionPrompt>(QUESTION_BANK.map((q) => [q.id, q]));

const QUESTIONS_BY_SKILL_MAP = (() => {
  const map = new Map<string, QuestionPrompt[]>();
  for (const question of QUESTION_BANK) {
    for (const skillId of question.skillIds) {
      let list = map.get(skillId);
      if (!list) {
        list = [];
        map.set(skillId, list);
      }
      list.push(question);
    }
  }
  return map;
})();

const BY_TEXT = new Map(QUESTION_BANK.map((q) => [q.text.toLowerCase(), q]));

/**
 * Questions tagged to a specific skill. Does not mix in general questions;
 * use getGeneralQuestions() for those.
 * Uses an indexed lookup plus O(k) copying to preserve independent results.
 */
export function getQuestionsForSkill(skillId: string): QuestionPrompt[] {
  return [...(QUESTIONS_BY_SKILL_MAP.get(skillId) ?? [])];
}

export function getGeneralQuestions(): QuestionPrompt[] {
  return getQuestionsForSkill('general');
}

/**
 * Finds a question by ID in O(1) time.
 */
export function getQuestionById(id: string): QuestionPrompt | undefined {
  return QUESTION_MAP.get(id);
}

/** The bank question with exactly this wording, if there is one. */
export function findQuestionByText(text: string): QuestionPrompt | undefined {
  return BY_TEXT.get(text.replace(/\s+/g, ' ').trim().toLowerCase());
}

/**
 * Story.questionPrompts holds bank question ids for attached questions and
 * raw text for custom ones. This resolves either to display text.
 */
export function resolveQuestionText(idOrText: string): string {
  return QUESTION_MAP.get(idOrText)?.text ?? idOrText;
}

/** Skills the posting must name before this question is offered. Empty means always. */
function requiredPostingSkills(question: QuestionPrompt): readonly string[] {
  if (question.onlyFor) return question.onlyFor;
  if (question.category !== 'technical') return [];
  return question.skillIds.filter((id) => {
    const category = SKILL_MAP.get(id)?.category;
    return category === 'technical' || category === 'domain';
  });
}

export interface QuestionFilter {
  /** Who is preparing. Questions that do not suit them are left out. */
  audience?: Audience;
  /**
   * Skills the posting names. A technical question is offered only when the
   * posting names its technology. Leave undefined when there is no posting:
   * technical questions are then left out too.
   */
  postingSkillIds?: Iterable<string>;
}

/** Whether a question suits this visitor and this posting. */
export function questionFits(question: QuestionPrompt, filter: QuestionFilter = {}): boolean {
  if (filter.audience && !question.audiences.includes(filter.audience)) return false;
  const needs = requiredPostingSkills(question);
  if (needs.length === 0) return true;
  const named = new Set(filter.postingSkillIds ?? []);
  return needs.some((id) => named.has(id));
}

/** Questions for a skill that suit this visitor and this posting, bank order. */
export function questionsFor(skillId: string, filter: QuestionFilter = {}): QuestionPrompt[] {
  return getQuestionsForSkill(skillId).filter((q) => questionFits(q, filter));
}

// ============================================================================
// Suggested Questions to Ask (for Packet)
// ============================================================================

export const SUGGESTED_QUESTIONS_TO_ASK = [
  'What does success look like in this role after 90 days?',
  'How does the team prioritize when requirements change?',
  "What's the biggest challenge the team is facing right now?",
  'How would you describe the team culture?',
  'What opportunities are there for growth and learning?',
  'Can you walk me through a typical project lifecycle here?',
  'What is something the team would change about how it works today?',
  "What's the onboarding process like?",
  'How do you measure performance?',
  'What do you enjoy most about working here?',
];

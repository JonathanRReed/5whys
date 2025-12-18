/**
 * Interview Glow Up - Skill Bank & Question Bank
 * 
 * Single source-of-truth for skills and question prompts.
 * Add/rename skills here without refactoring the rest of the app.
 */

// ============================================================================
// Skill Bank
// ============================================================================

export interface Skill {
    id: string;
    name: string;
    category: 'technical' | 'soft' | 'domain' | 'general';
    keywords: string[];  // For auto-detection
}

export const SKILL_BANK: Skill[] = [
    // Technical Skills
    { id: 'python', name: 'Python', category: 'technical', keywords: ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy'] },
    { id: 'javascript', name: 'JavaScript', category: 'technical', keywords: ['javascript', 'js', 'typescript', 'ts', 'node', 'react', 'vue', 'angular'] },
    { id: 'java', name: 'Java', category: 'technical', keywords: ['java', 'spring', 'maven', 'gradle', 'jvm'] },
    { id: 'sql', name: 'SQL/Databases', category: 'technical', keywords: ['sql', 'mysql', 'postgresql', 'database', 'mongodb', 'redis', 'nosql'] },
    { id: 'cloud', name: 'Cloud (AWS/GCP/Azure)', category: 'technical', keywords: ['aws', 'gcp', 'azure', 'cloud', 'ec2', 's3', 'lambda', 'kubernetes', 'docker'] },
    { id: 'ml', name: 'Machine Learning/AI', category: 'technical', keywords: ['machine learning', 'ml', 'ai', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'llm'] },
    { id: 'security', name: 'Security/Cybersecurity', category: 'technical', keywords: ['security', 'cybersecurity', 'encryption', 'vulnerability', 'penetration', 'soc', 'siem'] },
    { id: 'devops', name: 'DevOps/CI-CD', category: 'technical', keywords: ['devops', 'ci/cd', 'jenkins', 'github actions', 'terraform', 'ansible', 'infrastructure'] },
    { id: 'api', name: 'API Design', category: 'technical', keywords: ['api', 'rest', 'graphql', 'grpc', 'microservices', 'integration'] },
    { id: 'frontend', name: 'Frontend Development', category: 'technical', keywords: ['frontend', 'front-end', 'css', 'html', 'ui', 'responsive', 'accessibility'] },
    { id: 'backend', name: 'Backend Development', category: 'technical', keywords: ['backend', 'back-end', 'server', 'scalability', 'architecture'] },
    { id: 'mobile', name: 'Mobile Development', category: 'technical', keywords: ['mobile', 'ios', 'android', 'react native', 'flutter', 'swift', 'kotlin'] },
    { id: 'data-analysis', name: 'Data Analysis', category: 'technical', keywords: ['data analysis', 'analytics', 'visualization', 'tableau', 'power bi', 'excel'] },

    // Soft Skills
    { id: 'communication', name: 'Communication', category: 'soft', keywords: ['communication', 'communicate', 'present', 'stakeholder', 'collaborate', 'written', 'verbal'] },
    { id: 'leadership', name: 'Leadership', category: 'soft', keywords: ['leadership', 'lead', 'manage', 'mentor', 'coach', 'influence', 'vision'] },
    { id: 'teamwork', name: 'Teamwork', category: 'soft', keywords: ['teamwork', 'team', 'collaborate', 'cross-functional', 'partner'] },
    { id: 'problem-solving', name: 'Problem Solving', category: 'soft', keywords: ['problem solving', 'troubleshoot', 'debug', 'root cause', 'analytical', 'critical thinking'] },
    { id: 'adaptability', name: 'Adaptability', category: 'soft', keywords: ['adaptability', 'flexible', 'ambiguity', 'change', 'pivot', 'fast-paced'] },
    { id: 'time-management', name: 'Time Management', category: 'soft', keywords: ['time management', 'prioritize', 'deadline', 'multitask', 'organize'] },
    { id: 'ownership', name: 'Ownership/Initiative', category: 'soft', keywords: ['ownership', 'initiative', 'proactive', 'self-starter', 'autonomous', 'end-to-end'] },
    { id: 'attention-to-detail', name: 'Attention to Detail', category: 'soft', keywords: ['attention to detail', 'detail-oriented', 'meticulous', 'quality', 'accuracy'] },

    // Domain Skills
    { id: 'agile', name: 'Agile/Scrum', category: 'domain', keywords: ['agile', 'scrum', 'sprint', 'kanban', 'jira', 'standup'] },
    { id: 'product', name: 'Product Thinking', category: 'domain', keywords: ['product', 'roadmap', 'requirements', 'user stories', 'prd', 'backlog'] },
    { id: 'ux', name: 'UX/User Research', category: 'domain', keywords: ['ux', 'user experience', 'user research', 'usability', 'design thinking', 'wireframe'] },
    { id: 'finance', name: 'Finance/Fintech', category: 'domain', keywords: ['finance', 'fintech', 'banking', 'payments', 'trading', 'compliance'] },
    { id: 'healthcare', name: 'Healthcare/Biotech', category: 'domain', keywords: ['healthcare', 'hipaa', 'clinical', 'biotech', 'pharma', 'medical'] },
    { id: 'ecommerce', name: 'E-commerce/Retail', category: 'domain', keywords: ['ecommerce', 'e-commerce', 'retail', 'marketplace', 'inventory', 'supply chain'] },

    // General
    { id: 'general', name: 'General', category: 'general', keywords: [] },
];

export const SKILL_MAP = new Map(SKILL_BANK.map(s => [s.id, s]));

export function getSkillById(id: string): Skill | undefined {
    return SKILL_MAP.get(id);
}

export function getSkillName(id: string): string {
    return SKILL_MAP.get(id)?.name ?? id;
}

// ============================================================================
// Smart Skill Detection
// ============================================================================

export interface SkillSuggestion {
    skillId: string;
    confidence: number;  // 0-100
}

export function detectSkillsFromText(text: string): SkillSuggestion[] {
    const lowerText = text.toLowerCase();
    const suggestions: SkillSuggestion[] = [];

    for (const skill of SKILL_BANK) {
        if (skill.keywords.length === 0) continue;

        let matchCount = 0;
        let totalKeywords = skill.keywords.length;

        for (const keyword of skill.keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                matchCount++;
            }
        }

        if (matchCount > 0) {
            // Confidence based on keyword matches and text length
            const keywordRatio = matchCount / Math.min(totalKeywords, 3);
            const confidence = Math.min(95, Math.round(keywordRatio * 80 + 15));
            suggestions.push({ skillId: skill.id, confidence });
        }
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions.slice(0, 3); // Top 3 suggestions
}

// ============================================================================
// Question Bank
// ============================================================================

export interface QuestionPrompt {
    id: string;
    text: string;
    skillIds: string[];  // Can apply to multiple skills
    category: 'behavioral' | 'technical' | 'situational' | 'general';
}

export const QUESTION_BANK: QuestionPrompt[] = [
    // General Questions
    { id: 'q-intro', text: 'Tell me about yourself.', skillIds: ['general'], category: 'general' },
    { id: 'q-why-company', text: 'Why do you want to work here?', skillIds: ['general'], category: 'general' },
    { id: 'q-why-role', text: 'Why are you interested in this role?', skillIds: ['general'], category: 'general' },
    { id: 'q-strengths', text: 'What are your greatest strengths?', skillIds: ['general'], category: 'general' },
    { id: 'q-weaknesses', text: 'What is your biggest weakness?', skillIds: ['general'], category: 'general' },

    // Leadership
    { id: 'q-lead-project', text: 'Tell me about a time you led a project.', skillIds: ['leadership', 'ownership'], category: 'behavioral' },
    { id: 'q-lead-conflict', text: 'How do you handle conflict within your team?', skillIds: ['leadership', 'communication'], category: 'behavioral' },
    { id: 'q-lead-mentor', text: 'Describe a time you mentored someone.', skillIds: ['leadership', 'teamwork'], category: 'behavioral' },
    { id: 'q-lead-decision', text: 'Tell me about a difficult decision you had to make as a leader.', skillIds: ['leadership', 'problem-solving'], category: 'behavioral' },

    // Problem Solving
    { id: 'q-ps-complex', text: 'Describe a complex problem you solved.', skillIds: ['problem-solving'], category: 'behavioral' },
    { id: 'q-ps-debug', text: 'Walk me through how you debug a production issue.', skillIds: ['problem-solving', 'backend'], category: 'technical' },
    { id: 'q-ps-tradeoff', text: 'Tell me about a time you had to make a tradeoff.', skillIds: ['problem-solving', 'product'], category: 'situational' },
    { id: 'q-ps-ambiguity', text: 'How do you handle ambiguous requirements?', skillIds: ['problem-solving', 'adaptability'], category: 'situational' },

    // Communication
    { id: 'q-comm-explain', text: 'Explain a technical concept to a non-technical audience.', skillIds: ['communication'], category: 'behavioral' },
    { id: 'q-comm-disagree', text: 'Tell me about a time you disagreed with a stakeholder.', skillIds: ['communication', 'leadership'], category: 'behavioral' },
    { id: 'q-comm-feedback', text: 'How do you give and receive feedback?', skillIds: ['communication', 'teamwork'], category: 'behavioral' },

    // Teamwork
    { id: 'q-team-collab', text: 'Describe a successful cross-functional collaboration.', skillIds: ['teamwork', 'communication'], category: 'behavioral' },
    { id: 'q-team-difficult', text: 'Tell me about a time you worked with a difficult teammate.', skillIds: ['teamwork', 'adaptability'], category: 'behavioral' },
    { id: 'q-team-remote', text: 'How do you collaborate with remote team members?', skillIds: ['teamwork', 'communication'], category: 'situational' },

    // Technical - General
    { id: 'q-tech-design', text: 'Walk me through a system you designed.', skillIds: ['backend', 'api', 'cloud'], category: 'technical' },
    { id: 'q-tech-scale', text: 'How would you scale a service handling 10x traffic?', skillIds: ['backend', 'cloud', 'devops'], category: 'technical' },
    { id: 'q-tech-learn', text: 'How do you stay current with new technologies?', skillIds: ['general'], category: 'behavioral' },

    // Ownership
    { id: 'q-own-initiative', text: 'Tell me about a time you took initiative beyond your role.', skillIds: ['ownership'], category: 'behavioral' },
    { id: 'q-own-failure', text: 'Describe a project that failed. What did you learn?', skillIds: ['ownership', 'problem-solving'], category: 'behavioral' },
    { id: 'q-own-improve', text: 'Tell me about a process you improved.', skillIds: ['ownership', 'problem-solving'], category: 'behavioral' },

    // Adaptability
    { id: 'q-adapt-change', text: 'Describe a time requirements changed mid-project.', skillIds: ['adaptability', 'agile'], category: 'situational' },
    { id: 'q-adapt-learn', text: 'Tell me about a time you had to learn something quickly.', skillIds: ['adaptability'], category: 'behavioral' },
    { id: 'q-adapt-pressure', text: 'How do you perform under pressure?', skillIds: ['adaptability', 'time-management'], category: 'situational' },

    // Time Management
    { id: 'q-time-priority', text: 'How do you prioritize competing deadlines?', skillIds: ['time-management'], category: 'situational' },
    { id: 'q-time-missed', text: 'Tell me about a time you missed a deadline. What happened?', skillIds: ['time-management', 'ownership'], category: 'behavioral' },
];

export function getQuestionsForSkill(skillId: string): QuestionPrompt[] {
    return QUESTION_BANK.filter(q => q.skillIds.includes(skillId) || q.skillIds.includes('general'));
}

export function getQuestionById(id: string): QuestionPrompt | undefined {
    return QUESTION_BANK.find(q => q.id === id);
}

// ============================================================================
// Suggested Questions to Ask (for Packet)
// ============================================================================

export const SUGGESTED_QUESTIONS_TO_ASK = [
    "What does success look like in this role after 90 days?",
    "How does the team prioritize when requirements change?",
    "What's the biggest challenge the team is facing right now?",
    "How would you describe the team culture?",
    "What opportunities are there for growth and learning?",
    "Can you walk me through a typical project lifecycle here?",
    "How does the team handle technical debt?",
    "What's the onboarding process like?",
    "How do you measure performance?",
    "What do you enjoy most about working here?",
];

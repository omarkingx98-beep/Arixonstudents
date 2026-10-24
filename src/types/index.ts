export type ThemeMode = 'light' | 'dark';
export type Language = 'ar' | 'en';

export interface UserProfile {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  photoURL?: string;
  age?: number;
  city?: string;
  branch?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  whatsappGroup?: string;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  examsCompleted: number;
  correctAnswers: number;
  wrongAnswers: number;
  hasSeenTutorial?: boolean;
  accountDisabled?: boolean;
  disabledReason?: string | null;
  disabledAt?: string | null;
  chatDisabled?: boolean;
  showAgeInPublicProfile?: boolean;
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string;
}

export type SubjectId = 
  | 'all' 
  | 'math' 
  | 'physics' 
  | 'arabic' 
  | 'chemistry' 
  | 'biology' 
  | 'english' 
  | 'islamic' 
  | 'history' 
  | 'geography' 
  | 'islamic_studies' 
  | 'financial_culture' 
  | 'geology' 
  | 'computer' 
  | 'other';

export interface DailyGoal {
  id: string;
  userId: string;
  text: string;
  subject?: SubjectId;
  priority?: 'normal' | 'important' | 'urgent';
  estimatedMinutes?: number;
  completed: boolean;
  completedAt?: string | null;
  date: string; // YYYY-MM-DD
  createdAt: string;
}

export type ExamStatus = 
  | 'draft' 
  | 'published' 
  | 'unpublished' 
  | 'archived' 
  | 'available' 
  | 'coming_soon' 
  | 'closed' 
  | 'completed';

export interface Exam {
  id: string;
  title: string;
  subject: SubjectId;
  subjectNameAr: string;
  lesson: string;
  description: string;
  questionCount: number;
  durationMinutes: number;
  totalPoints: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: ExamStatus;
  published: boolean;
  version?: number; // Version tracking (increments on edit of published exam)
  allowRetake: boolean;
  branch?: string; // 'علمي' | 'أدبي' | 'مشترك' | 'all'
  grade?: string; // e.g. 'tw2009'
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  // Optional client enrichment
  userAttemptStatus?: 'not_started' | 'in_progress' | 'completed' | 'submitted_pending';
  userLastAttemptId?: string;
  userScore?: number;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'matching';

export interface Question {
  id: string;
  examId?: string;
  questionText: string;
  options: string[];
  correctAnswer?: number; // Only exposed after submission or on server
  explanation?: string; // Only exposed after submission or on server
  hint?: string; // Educational hint to guide student without revealing answer
  solutionSteps?: string[]; // Step-by-step pedagogical solution
  formulaUsed?: string; // Formula or law applied
  distractorAnalysis?: Record<string, string>; // Analysis of traps/distractors for wrong options
  difficulty: 'easy' | 'medium' | 'hard';
  source: string;
  points: number;
  order: number;
  questionType: QuestionType;
  media?: string;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'expired' | 'submitted_pending';

export interface ExamAttempt {
  id: string;
  userId: string;
  examId: string;
  examVersion?: number; // Locks attempt to the specific exam version taken
  startedAt: string;
  expectedEndAt: string;
  submittedAt: string | null;
  status: AttemptStatus;
  pendingReason?: string;
  score: number | null;
  percentage?: number;
  pointsEarned: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  durationSeconds: number;
  lastSavedAt: string;
  // Metadata for easy display in history
  examTitle?: string;
  examSubject?: string;
  lesson?: string;
  totalPoints?: number;
  userDisplayName?: string;
  isRetake?: boolean;
  correctCount?: number;
  wrongCount?: number;
  unansweredCount?: number;
  durationUsed?: number;
  reviews?: QuestionReview[];
}

export interface QuestionAnswer {
  questionId: string;
  selectedAnswer: number | string | null;
  answeredAt: string;
  updatedAt: string;
}

export interface QuestionReview {
  questionId: string;
  questionNumber: number;
  questionText: string;
  options: string[];
  studentAnswer: number | null;
  studentOptionId?: string | null;
  studentAnswerText?: string | null;
  correctAnswer: number;
  correctOptionId?: string;
  correctAnswerText?: string;
  isCorrect: boolean;
  isUnanswered: boolean;
  explanation: string;
  hint?: string;
  solutionSteps?: string[];
  formulaUsed?: string;
  distractorAnalysis?: Record<string, string>;
  points: number;
  pointsEarned: number;
  source: string;
}

export interface LeaderboardEntry {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  points: number;
  rank: number;
  isCurrentUser?: boolean;
}

export type NavigationTab = 'home' | 'exams' | 'leaderboard' | 'profile';

// ==========================================
// Phase 3: Admin & Security Models
// ==========================================

export type AdminRole = 'super_admin' | 'admin' | 'editor';

export interface AdminProfile {
  uid: string;
  email: string;
  displayName: string;
  role: AdminRole;
  photoURL?: string;
  createdAt: string;
  lastLoginAt: string;
}

export type AdminAuditAction = 
  | 'create_exam'
  | 'edit_exam'
  | 'publish_exam'
  | 'unpublish_exam'
  | 'archive_exam'
  | 'delete_exam'
  | 'add_question'
  | 'edit_question'
  | 'archive_question'
  | 'delete_question'
  | 'import_questions'
  | 'export_data'
  | 'disable_student'
  | 'enable_student'
  | 'disable_student_chat'
  | 'enable_student_chat'
  | 'update_student_branch'
  | 'send_student_notification'
  | 'point_adjustment'
  | 'publish_announcement'
  | 'unpublish_announcement'
  | 'archive_announcement'
  | 'publish_challenge'
  | 'edit_challenge'
  | 'ai_generation'
  | 'ai_approval'
  | 'save_approved_questions'
  | 'create_template'
  | 'settings_change'
  | 'admin_bootstrap'
  | 'student_report'
  | 'student_block'
  | 'permission_failure'
  | 'create_banner'
  | 'edit_banner'
  | 'delete_banner'
  | 'toggle_banner'
  | 'reorder_banners'
  | 'update_promo_settings';

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  action: AdminAuditAction;
  targetType: 'exam' | 'question' | 'student' | 'announcement' | 'challenge' | 'settings' | 'security' | 'template' | 'banner';
  targetId: string;
  details: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface QuestionBankItem {
  id: string;
  questionText: string;
  subject: SubjectId;
  subjectNameAr: string;
  lesson: string;
  topic?: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  distractorAnalysis?: Record<string, string>;
  difficulty: 'easy' | 'medium' | 'hard';
  source: string;
  points: number;
  questionType: QuestionType;
  media?: string;
  status: 'active' | 'draft' | 'archived' | 'approved';
  tags?: string[];
  isAiGenerated?: boolean;
  approved?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  image?: string;
  priority: 'low' | 'medium' | 'high';
  published: boolean;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
  createdBy: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  subject: SubjectId;
  startAt: string;
  endAt: string;
  points: number;
  examIds: string[];
  requirements?: string;
  status: 'upcoming' | 'active' | 'ended' | 'archived';
  createdBy: string;
  createdAt: string;
}

export interface PointAdjustmentRecord {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  reason: string;
  adminId: string;
  adminName: string;
  previousBalance: number;
  newBalance: number;
  createdAt: string;
}

export interface AdminSettings {
  siteName: string;
  logoUrl?: string;
  defaultDurationMinutes: number;
  defaultExamDurationMinutes?: number;
  defaultPointsPerQuestion?: number;
  defaultTotalPoints: number;
  allowRetakesDefault?: boolean;
  leaderboardVisible: boolean;
  leaderboardRefreshMinutes?: number;
  maintenanceMode: boolean;
  registrationOpen: boolean;
  announcementsEnabled: boolean;
  challengesEnabled: boolean;
  systemNotice?: string;
  updatedAt: string;
  updatedBy: string;
}

export type AdminTab = 
  | 'dashboard'
  | 'exams'
  | 'questions'
  | 'students'
  | 'leaderboard'
  | 'announcements'
  | 'banners'
  | 'challenges'
  | 'analytics'
  | 'ai-builder'
  | 'ai-import'
  | 'audit-logs'
  | 'settings'
  | 'profile';

export type PromoBannerLinkType = 'none' | 'internal' | 'external';

export interface PromoBanner {
  id: string;
  imageUrl: string;
  alt: string;
  linkType?: PromoBannerLinkType;
  linkTarget?: string;
  order: number;
  active: boolean;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

export interface PromoSettings {
  enabled: boolean;
  intervalSeconds: number;
}

// ==========================================
// PHASE 4: AI Exam Builder & Validation Types
// ==========================================

export type GenerationMode = 'source_based' | 'curriculum_based' | 'question_bank_based';

export type AiGenerationStatus = 
  | 'generated' 
  | 'validated' 
  | 'needs_review' 
  | 'approved' 
  | 'rejected' 
  | 'regenerated';

export interface CalculationVerification {
  expression: string;
  variables: Record<string, number | string>;
  expectedResult: number | string;
  unit?: string;
  formula?: string;
  evaluatedResult?: number | string;
  verified: boolean;
  verificationError?: string;
}

export interface SecondPassReview {
  status: 'PASS' | 'FAIL';
  confidence: number;
  reason: string;
  detectedIssues: string[];
  reviewedAt: string;
}

export interface QuestionQualityScores {
  contentAccuracy: number;
  structureScore: number;
  answerConsistency: number;
  calculationScore: number;
  difficultyFit: number;
  sourceGrounding: number;
  duplicateScore: number;
  overallScore: number; // 0 - 100
}

export interface AiGeneratedQuestionDraft {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  hint?: string;
  solutionSteps?: string[];
  formulaUsed?: string;
  distractorAnalysis?: Record<string, string>;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'multiple_choice' | 'true_false';
  suggestedPoints: number;
  subject: SubjectId;
  subjectNameAr: string;
  lesson: string;
  topic?: string;
  grade?: string;

  // Source Grounding
  sourceMode: GenerationMode;
  sourceId?: string;
  sourceSection?: string;
  sourceQuoteOrReference?: string;

  // Deterministic Math/Physics Calculation
  calculation?: CalculationVerification;
  calculationStatus?: 'VERIFIED' | 'FAILED_VERIFICATION' | 'NOT_APPLICABLE';

  // Stage 2 Review
  secondPassReview?: SecondPassReview;

  // Quality scoring
  qualityScores: QuestionQualityScores;

  // Status & Validation
  generationStatus: AiGenerationStatus;
  validationErrors: string[];
  validationWarnings: string[];
  isDuplicate: boolean;
  duplicateMatchDetails?: string;

  generatedByAI: true;
  createdAt: string;
  updatedAt: string;
}

export interface SourceSectionChunk {
  index: number;
  title: string;
  content: string;
  charCount: number;
  wordCount: number;
  detectedConcepts: string[];
}

export interface SourceIngestionReport {
  sourceId: string;
  sourceType: 'pasted_text' | 'notes' | 'lesson_content' | 'uploaded_doc' | 'question_bank' | 'structured_json';
  rawLength: number;
  wordCount: number;
  normalizedWordCount?: number;
  detectedSubject?: string;
  detectedLesson?: string;
  detectedConcepts: string[];
  detectedFormulas?: string[];
  chunks: SourceSectionChunk[];
  warnings: string[];
  isUsable: boolean;
  unusableReason?: string;
}

export type AiJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface AiGenerationJob {
  jobId: string;
  adminId: string;
  sourceId?: string;
  generationMode: GenerationMode;
  mode?: GenerationMode;
  generatedQuestions?: any[];
  subject: string;
  lesson: string;
  topic?: string;
  questionCount: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  status: AiJobStatus;
  createdAt: string;
  completedAt?: string;
  approvedCount: number;
  rejectedCount: number;
  failedCount: number;
  modelUsed: string;
  errorMessage?: string;
  generationSummary?: {
    total: number;
    valid: number;
    needsReview: number;
    failed: number;
    duplicates: number;
  };
}

export interface ExamTemplate {
  id: string;
  name: string;
  description: string;
  subject: SubjectId;
  questionCount: number;
  durationMinutes: number;
  totalPoints: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  difficultyDistribution?: {
    easy: number;
    medium: number;
    hard: number;
  };
  allowRetake: boolean;
}

export type IngestedSourceMaterial = SourceIngestionReport;





// ==========================================
// Phase 4: Social, Notifications & Realtime Chat
// ==========================================

export type NotificationType = 
  | 'chat_message' 
  | 'friend_request' 
  | 'friend_accept' 
  | 'admin_announcement' 
  | 'admin_direct_message'
  | 'exam_published'
  | 'exam_unpublished'
  | 'exam_republished'
  | 'exam_updated';

export type BroadcastType = 
  | 'exam_published' 
  | 'exam_unpublished' 
  | 'exam_republished' 
  | 'exam_updated' 
  | 'announcement';

export interface BroadcastAudience {
  grade?: string; // 'tw2009' | 'all'
  track: 'all' | 'scientific' | 'literary' | 'علمي' | 'أدبي' | 'مشترك';
}

export interface BroadcastNotification {
  id: string;
  type?: BroadcastType;
  title: string;
  message?: string;
  priority?: 'low' | 'normal' | 'medium' | 'high' | 'urgent';
  examId?: string;
  examTitle?: string;
  audience: BroadcastAudience;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
}

export interface StudentNotifState {
  lastReadAt: string;
  updatedAt?: string;
}

export interface AppNotification {
  id: string;
  recipientId: string;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderPhoto?: string;
  senderBranch?: string;
  receiverId: string;
  receiverName: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FriendItem {
  uid: string;
  displayName: string;
  username: string;
  photoURL?: string;
  branch?: string;
  totalPoints: number;
  friendSince: string;
}

export interface ChatConversation {
  id: string; // chat_{minUid}_{maxUid}
  participants: string[];
  participantDetails: Record<string, {
    displayName: string;
    username: string;
    photoURL?: string;
    branch?: string;
  }>;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  unreadCount?: Record<string, number>;
  unreadCounts?: Record<string, number>;
  reported?: boolean;
  reportReason?: string;
  reportedBy?: string;
  blockedBy?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  text: string;
  createdAt: string;
  read: boolean;
}

export interface PublicUserProfile {
  uid: string;
  displayName: string;
  username: string;
  usernameLower?: string;
  photoURL?: string;
  avatar?: string;
  branch?: string;
  track?: string;
  totalPoints: number;
  points?: number;
  rank?: number;
  age?: number;
  createdAt: string;
  examsCompleted?: number;
}

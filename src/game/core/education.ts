export interface EducationState {
  factsPresented: string[];
  quizzesCompleted: number;
  quizzesCorrect: number;
  pendingQuiz: Quiz | null;
}

export interface Quiz {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  relatedTopic: string;
  rewardKnowledgePoints: number;
}

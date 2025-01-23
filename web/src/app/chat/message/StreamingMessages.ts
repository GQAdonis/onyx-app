import { useState, useRef, useEffect } from "react";
import { SubQuestionDetail } from "../interfaces";

export enum StreamingPhase {
  WAITING = "waiting",
  SUB_QUERIES = "sub_queries",
  CONTEXT_DOCS = "context_docs",
  ANSWER = "answer",
  COMPLETE = "complete",
}

export const StreamingPhaseText: Record<StreamingPhase, string> = {
  [StreamingPhase.WAITING]: "Extracting key terms",
  [StreamingPhase.SUB_QUERIES]: "Identifying additional questions",
  [StreamingPhase.CONTEXT_DOCS]: "Reading through more documents",
  [StreamingPhase.ANSWER]: "Generating new refined answer",
  [StreamingPhase.COMPLETE]: "Comparing results",
};

interface SubQuestionProgress {
  questionDone: boolean;
  questionCharIndex: number;
  currentPhase: StreamingPhase;
  // Track when we started this phase
  phaseStartTime: number;
  waitingTimeoutSet: boolean;
  subQueryIndex: number;
  subQueryCharIndex: number;
  docIndex: number;
  lastDocTimestamp: number | null;
  answerCharIndex: number;
}

const PHASES_ORDER: StreamingPhase[] = [
  StreamingPhase.WAITING,
  StreamingPhase.SUB_QUERIES,
  StreamingPhase.CONTEXT_DOCS,
  StreamingPhase.ANSWER,
  StreamingPhase.COMPLETE,
];

export const PHASE_MIN_MS = 800; // Minimum phase duration in ms

function canTransition(p: SubQuestionProgress) {
  return Date.now() - p.phaseStartTime >= PHASE_MIN_MS;
}

export function useOrderedPhases(externalPhase: StreamingPhase) {
  const [phaseQueue, setPhaseQueue] = useState<StreamingPhase[]>([]);
  const [displayedPhase, setDisplayedPhase] = useState<StreamingPhase>(
    StreamingPhase.WAITING
  );
  const lastDisplayTimestampRef = useRef<number>(Date.now());

  const getPhaseIndex = (phase: StreamingPhase) => {
    return PHASES_ORDER.indexOf(phase);
  };

  useEffect(() => {
    setPhaseQueue((prevQueue) => {
      const lastQueuedPhase =
        prevQueue.length > 0 ? prevQueue[prevQueue.length - 1] : displayedPhase;

      const lastQueuedIndex = getPhaseIndex(lastQueuedPhase);
      const externalIndex = getPhaseIndex(externalPhase);

      if (externalIndex <= lastQueuedIndex) {
        return prevQueue;
      }

      const missingPhases: StreamingPhase[] = [];
      for (let i = lastQueuedIndex + 1; i <= externalIndex; i++) {
        missingPhases.push(PHASES_ORDER[i]);
      }
      return [...prevQueue, ...missingPhases];
    });
  }, [externalPhase, displayedPhase]);

  useEffect(() => {
    if (phaseQueue.length === 0) return;
    let rafId: number;

    const processQueue = () => {
      const now = Date.now();
      const elapsed = now - lastDisplayTimestampRef.current;

      // Keep this at 1000ms from the original example (unchanged),
      // but you can adjust if you want a different visible time in *this* component.
      if (elapsed >= 1000) {
        setPhaseQueue((prevQueue) => {
          if (prevQueue.length > 0) {
            const [next, ...rest] = prevQueue;
            setDisplayedPhase(next);
            lastDisplayTimestampRef.current = Date.now();
            return rest;
          }
          return prevQueue;
        });
      }
      rafId = requestAnimationFrame(processQueue);
    };

    rafId = requestAnimationFrame(processQueue);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [phaseQueue]);

  return StreamingPhaseText[displayedPhase];
}

const DOC_DELAY_MS = 100;

export const useStreamingMessages = (
  subQuestions: SubQuestionDetail[],
  allowStreaming: () => void
) => {
  const [dynamicSubQuestions, setDynamicSubQuestions] = useState<
    SubQuestionDetail[]
  >([]);

  const subQuestionsRef = useRef<SubQuestionDetail[]>(subQuestions);
  useEffect(() => {
    subQuestionsRef.current = subQuestions;
  }, [subQuestions]);

  const dynamicSubQuestionsRef = useRef<SubQuestionDetail[]>([]);

  const progressRef = useRef<SubQuestionProgress[]>([]);

  useEffect(() => {
    subQuestions.forEach((sq, i) => {
      if (!progressRef.current[i]) {
        progressRef.current[i] = {
          questionDone: false,
          questionCharIndex: 0,
          waitingTimeoutSet: false,
          // Start subQ #0 in SUB_QUERIES immediately, others in WAITING
          currentPhase: StreamingPhase.WAITING,
          // i === 0 ? StreamingPhase.SUB_QUERIES : StreamingPhase.WAITING,
          // We set the phase start time right away
          phaseStartTime: Date.now(),
          subQueryIndex: 0,
          subQueryCharIndex: 0,
          docIndex: 0,
          lastDocTimestamp: null,
          answerCharIndex: 0,
        };
      }

      if (!dynamicSubQuestionsRef.current[i]) {
        dynamicSubQuestionsRef.current[i] = {
          level: sq.level,
          level_question_nr: sq.level_question_nr,
          question: "",
          answer: "",
          sub_queries: [],
          context_docs: { top_documents: [] },
        };
      }
    });

    setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
  }, [subQuestions]);

  useEffect(() => {
    let stop = false;

    function loadNextPiece() {
      if (stop) return;

      const actualSubQs = subQuestionsRef.current;
      if (!actualSubQs || actualSubQs.length === 0) {
        setTimeout(loadNextPiece, 100);
        return;
      }

      // 1) Stream high-level questions in parallel
      let didStreamQuestion = false;
      for (let i = 0; i < actualSubQs.length; i++) {
        const sq = actualSubQs[i];
        const p = progressRef.current[i];
        const dynSQ = dynamicSubQuestionsRef.current[i];

        if (sq.question) {
          const nextIndex = p.questionCharIndex + 1;
          if (nextIndex <= sq.question.length) {
            dynSQ.question = sq.question.slice(0, nextIndex);
            p.questionCharIndex = nextIndex;
            if (nextIndex >= sq.question.length) {
              p.questionDone = true;
            }
            didStreamQuestion = true;
          }
        }
      }

      if (didStreamQuestion) {
        setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
        setTimeout(loadNextPiece, 2);
        return;
      }

      // 2) Handle SUB_QUERIES → CONTEXT_DOCS → ANSWER → COMPLETE
      for (let i = 0; i < actualSubQs.length; i++) {
        const sq = actualSubQs[i];
        const dynSQ = dynamicSubQuestionsRef.current[i];
        const p = progressRef.current[i];

        // Wait for subquestion #0 or the previous subquestion's progress
        if (p.currentPhase === StreamingPhase.WAITING) {
          if (i === 0) {
            // subquestion #0 can move on if 300ms has passed in WAITING (though it starts in SUB_QUERIES by default)
            if (canTransition(p)) {
              p.currentPhase = StreamingPhase.SUB_QUERIES;
              p.phaseStartTime = Date.now();
            }
          } else {
            const prevP = progressRef.current[i - 1];
            if (
              prevP.currentPhase === StreamingPhase.ANSWER ||
              prevP.currentPhase === StreamingPhase.COMPLETE
            ) {
              // Can only proceed if we've spent enough time in WAITING
              if (canTransition(p) && !p.waitingTimeoutSet) {
                p.waitingTimeoutSet = true;
                setTimeout(() => {
                  p.currentPhase = StreamingPhase.SUB_QUERIES;
                  p.phaseStartTime = Date.now();
                }, PHASE_MIN_MS);
              }
            }
          }
        }

        switch (p.currentPhase) {
          case StreamingPhase.SUB_QUERIES: {
            const subQueries = sq.sub_queries || [];
            const docs = sq.context_docs?.top_documents || [];
            const hasDocs = docs.length > 0;
            const hasAnswer = !!sq.answer?.length;

            // "Stream" the subqueries (in this code, it just sets them all at once)
            while (dynSQ.sub_queries!.length < subQueries.length) {
              dynSQ.sub_queries!.push({
                query: "",
                query_id: subQueries[0].query_id,
              });
            }
            for (let j = 0; j < subQueries.length; j++) {
              if (
                dynSQ.sub_queries![j].query.length < subQueries[j].query.length
              ) {
                dynSQ.sub_queries![j].query = subQueries[j].query;
              } else {
                // console.log("NOT STEAMING");
              }
            }
            // console.log(subQueries);

            // If we've "done" subqueries and see docs or an answer, move on — but only if 300ms have passed
            if (hasDocs || hasAnswer) {
              if (canTransition(p)) {
                p.currentPhase = StreamingPhase.CONTEXT_DOCS;
                p.phaseStartTime = Date.now();
                p.lastDocTimestamp = null;
              }
            }
            break;
          }

          case StreamingPhase.CONTEXT_DOCS: {
            const docs = sq.context_docs?.top_documents || [];
            const hasAnswer = !!sq.answer?.length;

            // If we see an answer but no docs, jump to ANSWER
            if (hasAnswer && docs.length === 0) {
              if (canTransition(p)) {
                p.currentPhase = StreamingPhase.ANSWER;
                p.phaseStartTime = Date.now();
              }
              break;
            }

            // Add all docs at once (same as original)
            if (p.docIndex < docs.length) {
              docs.forEach((docToAdd) => {
                const alreadyAdded = dynSQ.context_docs?.top_documents.some(
                  (d) => d.document_id === docToAdd.document_id
                );
                if (!alreadyAdded) {
                  dynSQ.context_docs?.top_documents.push(docToAdd);
                }
              });
              p.docIndex = docs.length;
              p.lastDocTimestamp = Date.now();
            }

            if (hasAnswer) {
              // Once we've added all docs and see an answer, move on *after* 300ms
              if (canTransition(p)) {
                p.currentPhase = StreamingPhase.ANSWER;
                p.phaseStartTime = Date.now();
              }
            }
            break;
          }

          case StreamingPhase.ANSWER: {
            const answerText = sq.answer || "";
            const remainingChars = answerText.length - p.answerCharIndex;
            const charsToStream = Math.min(remainingChars, 10);

            if (charsToStream > 0) {
              const nextIndex = p.answerCharIndex + charsToStream;
              dynSQ.answer = answerText.slice(0, nextIndex);
              p.answerCharIndex = nextIndex;

              // If we've streamed everything and it's "complete"
              if (nextIndex >= answerText.length && sq.is_complete) {
                // Only move to COMPLETE if 300ms has passed in ANSWER
                if (canTransition(p)) {
                  dynSQ.is_complete = true;
                  p.currentPhase = StreamingPhase.COMPLETE;
                  p.phaseStartTime = Date.now();
                  console.log("ANSWER COMPLETE");

                  // Check if this is the last subquestion at level 0
                  if (
                    sq.level === 0 &&
                    sq.level_question_nr ===
                      Math.max(
                        ...subQuestions
                          .filter((q) => q.level === 0)
                          .map((q) => q.level_question_nr)
                      )
                  ) {
                    console.log("ALLOW STREAMING");
                    allowStreaming();
                  } else {
                    console.log("DO NOT ALLOW STREAMING");
                  }
                }
              }
            }
            break;
          }

          case StreamingPhase.COMPLETE:
          case StreamingPhase.WAITING:
          default:
            break;
        }
      }

      setDynamicSubQuestions([...dynamicSubQuestionsRef.current]);
      setTimeout(loadNextPiece, 2);
    }

    loadNextPiece();

    return () => {
      stop = true;
    };
  }, []);

  return { dynamicSubQuestions };
};

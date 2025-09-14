"use client";

import React, { useState, useEffect, useContext } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/nextjs";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { chatSession } from "@/utils/GeminiAIModal";
import { db } from "@/utils/db";
import { UserAnswer } from "@/utils/schema";
import moment from "moment";
import useSpeechToText from "react-hook-speech-to-text";
import { WebCamContext } from "@/app/dashboard/layout";
import Webcam from "react-webcam";

const InteractiveInterview = ({
  interviewData,
  mockInterviewQuestion,
  activeQuestionIndex,
  setActiveQuestionIndex,
}) => {
  const [userAnswer, setUserAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const { user } = useUser();
  const { webCamEnabled } = useContext(WebCamContext);

  const {
    error,
    isRecording,
    results,
    startSpeechToText,
    stopSpeechToText,
    setResults,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
  });

  // Function to make the AI speak. It no longer starts the recording.
  const textToSpeech = (text) => {
    // Cancel any ongoing speech before starting a new one
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => setIsAISpeaking(true);
    utterance.onend = () => setIsAISpeaking(false);
    speechSynthesis.speak(utterance);
  };

  // Greet the user and ask the first question
  useEffect(() => {
    if (mockInterviewQuestion?.length > 0 && user) {
      const initialGreeting = `Hello, ${user.fullName}! Welcome to your mock interview for the ${interviewData?.jobPosition} position. Let's begin with your first question. ${mockInterviewQuestion[0]?.Question}`;
      textToSpeech(initialGreeting);
    }
  }, [mockInterviewQuestion, user]);

  // Update userAnswer state from speech recognition results
  useEffect(() => {
    const transcript = results.map((result) => result.transcript).join(" ");
    setUserAnswer(transcript);
  }, [results]);

  // Main function to handle the recording toggle
  const handleToggleRecording = async () => {
    if (isRecording) {
      stopSpeechToText();
    } else {
      startSpeechToText();
    }
  };

  // Process the answer when the recording is stopped by the user
  useEffect(() => {
    if (!isRecording && userAnswer.length > 5) {
      setLoading(true);
      const processAnswer = async () => {
        const feedbackPrompt = `
                    This is a mock interview.
                    Question: "${
                      mockInterviewQuestion[activeQuestionIndex]?.Question
                    }"
                    Candidate's Answer: "${userAnswer}"

                    Based on the candidate's answer, please do the following:
                    1. Provide a rating for the answer from 1 to 10.
                    2. Give brief feedback (2-3 lines).
                    3. Acknowledge the answer naturally (e.g., "I see," or "Thanks for sharing that.").
                    4. Ask the next question: "${
                      mockInterviewQuestion[activeQuestionIndex + 1]?.Question
                    }"
                    
                    If this is the last question, instead of asking a new one, say "Thank you, that concludes our interview."

                    Provide your entire response as a single string of text that you would speak out loud, and also provide the rating and feedback in a JSON format like this: {"rating": "your_rating", "feedback": "your_feedback", "ai_response": "your_spoken_response"}
                `;

        try {
          const result = await chatSession.sendMessage(feedbackPrompt);
          let responseText = result.response
            .text()
            .replace(/```json|```/g, "")
            .trim();
          const jsonResponse = JSON.parse(responseText);

          await db.insert(UserAnswer).values({
            mockIdRef: interviewData.mockId,
            question: mockInterviewQuestion[activeQuestionIndex]?.Question,
            correctAns: mockInterviewQuestion[activeQuestionIndex]?.Answer,
            userAns: userAnswer,
            feedback: jsonResponse.feedback,
            rating: jsonResponse.rating,
            userEmail: user?.primaryEmailAddress?.emailAddress,
            createdAt: moment().format("YYYY-MM-DD"),
          });

          toast("Answer processed.");
          textToSpeech(jsonResponse.ai_response);

          if (activeQuestionIndex < mockInterviewQuestion.length - 1) {
            setActiveQuestionIndex(activeQuestionIndex + 1);
          } else {
            setTimeout(() => {
              window.location.href = `/dashboard/interview/${interviewData.mockId}/feedback`;
            }, 4000);
          }
        } catch (e) {
          console.error("Error processing AI response:", e);
          toast.error(
            "There was an error with the AI. Trying the next question."
          );
          const nextQuestionText =
            activeQuestionIndex < mockInterviewQuestion.length - 1
              ? `Let's move to the next question. ${
                  mockInterviewQuestion[activeQuestionIndex + 1]?.Question
                }`
              : "It seems we've reached the end. Thank you for your time.";
          textToSpeech(nextQuestionText);
          if (activeQuestionIndex < mockInterviewQuestion.length - 1) {
            setActiveQuestionIndex(activeQuestionIndex + 1);
          }
        } finally {
          setUserAnswer("");
          setResults([]);
          setLoading(false);
        }
      };
      processAnswer();
    }
  }, [isRecording]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full mt-10">
      {/* Webcam Display */}
      <div className="relative">
        {webCamEnabled ? (
          <Webcam
            mirrored={true}
            style={{
              height: 300,
              width: 500,
              zIndex: 10,
              borderRadius: "10px",
            }}
          />
        ) : (
          <div className="h-[300px] w-[500px] bg-gray-800 rounded-lg flex items-center justify-center">
            <Mic className="h-20 w-20 text-gray-500" />
          </div>
        )}
      </div>

      {/* User's Transcribed Answer */}
      <div className="w-full max-w-lg mt-4 p-4 border rounded-lg h-24 overflow-y-auto bg-secondary">
        <p className="text-gray-500">
          {userAnswer || "Your transcribed answer will appear here..."}
        </p>
      </div>

      {/* Recording Button */}
      <Button
        disabled={loading || isAISpeaking}
        onClick={handleToggleRecording}
        className="mt-6"
      >
        {isRecording ? (
          <div className="flex items-center gap-2 text-red-500 animate-pulse">
            <Mic /> Stop Recording
          </div>
        ) : (
          "Record Answer"
        )}
      </Button>

      {loading && (
        <p className="mt-2 text-sm text-gray-500">Processing your answer...</p>
      )}
      {isAISpeaking && (
        <p className="mt-2 text-sm text-green-500">AI is speaking...</p>
      )}
    </div>
  );
};

export default InteractiveInterview;

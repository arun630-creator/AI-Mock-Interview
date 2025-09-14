"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";
import React, { useContext, useEffect, useState } from "react";
import Webcam from "react-webcam";
import useSpeechToText from "react-hook-speech-to-text";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { chatSession } from "@/utils/GeminiAIModal";
import { db } from "@/utils/db";
import { UserAnswer } from "@/utils/schema";
import { useUser } from "@clerk/nextjs";
import moment from "moment";
import { WebCamContext } from "@/app/dashboard/layout";

const RecordAnswerSection = ({
  mockInterviewQuestion,
  activeQuestionIndex,
  interviewData,
  setActiveQuestionIndex,
}) => {
  const [userAnswer, setUserAnswer] = useState("");
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const { webCamEnabled } = useContext(WebCamContext);

  const {
    error,
    interimResult,
    isRecording,
    results,
    startSpeechToText,
    stopSpeechToText,
  } = useSpeechToText({
    continuous: true,
    useLegacyResults: false,
  });

  useEffect(() => {
    if (results.length > 0) {
      setUserAnswer(results.map((result) => result.transcript).join(" "));
    }
  }, [results]);

  const saveUserAnswer = async () => {
    if (isRecording) {
      stopSpeechToText();
    } else {
      startSpeechToText();
    }
  };

  useEffect(() => {
    const updateUserAnswerInDb = async () => {
      if (userAnswer.length < 10) return;
      setLoading(true);

      const feedbackPrompt = `
        Question: ${mockInterviewQuestion[activeQuestionIndex]?.Question}
        User Answer: ${userAnswer}
        Please provide feedback on my answer and suggest improvements in 3-5 lines. Format your response as JSON with "rating" and "feedback" fields.
      `;

      try {
        const result = await chatSession.sendMessage(feedbackPrompt);
        let mockJsonResp = result.response
          .text()
          .replace("```json", "")
          .replace("```", "");
        const jsonFeedbackResp = JSON.parse(mockJsonResp);

        const resp = await db.insert(UserAnswer).values({
          mockIdRef: interviewData.mockId,
          question: mockInterviewQuestion[activeQuestionIndex]?.Question,
          correctAns: mockInterviewQuestion[activeQuestionIndex]?.Answer,
          userAns: userAnswer,
          feedback: jsonFeedbackResp.feedback,
          rating: jsonFeedbackResp.rating,
          userEmail: user.primaryEmailAddress.emailAddress,
          createdAt: moment().format("YYYY-MM-DD"),
        });

        if (resp) {
          toast("Answer saved successfully!");
          setUserAnswer("");
          if (activeQuestionIndex < mockInterviewQuestion.length - 1) {
            setActiveQuestionIndex(activeQuestionIndex + 1);
          }
        }
      } catch (error) {
        console.error("Error saving answer:", error);
        toast("An error occurred while saving your answer.");
      } finally {
        setLoading(false);
      }
    };

    if (!isRecording) {
      updateUserAnswerInDb();
    }
  }, [isRecording]);

  return (
    <div className="flex items-center justify-center flex-col">
      <div className="flex flex-col mt-20 justify-center items-center bg-black rounded-lg p-5">
        <Image
          src={"/webcam.png"}
          width={200}
          height={200}
          className="absolute"
          alt="webcam"
        />
        <Webcam
          mirrored={true}
          style={{
            height: 300,
            width: "100%",
            zIndex: 10,
          }}
        />
      </div>
      <Button
        disabled={loading}
        variant="outline"
        className="my-10"
        onClick={saveUserAnswer}
      >
        {isRecording ? (
          <h2 className="text-red-600 animate-pulse flex gap-2 items-center">
            <Mic /> Stop Recording
          </h2>
        ) : (
          "Record Answer"
        )}
      </Button>
    </div>
  );
};

export default RecordAnswerSection;

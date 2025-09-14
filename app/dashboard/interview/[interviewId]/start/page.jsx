"use client";
import { db } from "@/utils/db";
import { MockInterview } from "@/utils/schema";
import { eq } from "drizzle-orm";
import React, { useState, useEffect } from "react";
import InteractiveInterview from "./_components/InteractiveInterview";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const StartInterview = ({ params }) => {
  const [interviewData, setInterviewData] = useState();
  const [mockInterviewQuestion, setMockInterviewQuestion] = useState();
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  useEffect(() => {
    GetInterviewDetails();
  }, []);

  const GetInterviewDetails = async () => {
    const result = await db
      .select()
      .from(MockInterview)
      .where(eq(MockInterview.mockId, params.interviewId));

    const jsonMockResp = JSON.parse(result[0].jsonMockResp);
    setMockInterviewQuestion(jsonMockResp);
    setInterviewData(result[0]);
  };

  return (
    <div className="p-10 flex flex-col items-center justify-center">
      <h2 className="font-bold text-2xl">Interview in Progress...</h2>
      {interviewData && mockInterviewQuestion ? (
        <InteractiveInterview
          interviewData={interviewData}
          mockInterviewQuestion={mockInterviewQuestion}
          activeQuestionIndex={activeQuestionIndex}
          setActiveQuestionIndex={setActiveQuestionIndex}
        />
      ) : (
        <p>Loading Interview...</p>
      )}
      <div className="flex justify-end w-full mt-4">
        <Link href={`/dashboard/interview/${params.interviewId}/feedback`}>
          <Button variant="outline">End Interview</Button>
        </Link>
      </div>
    </div>
  );
};

export default StartInterview;

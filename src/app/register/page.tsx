"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, User, Sparkles, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerStudent } from "@/actions/auth";
import { INTEREST_TAGS, DEPARTMENTS } from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  async function handleSubmit(formData: FormData) {
    setError("");
    setLoading(true);

    formData.set("department", selectedDept);
    // Clear existing interests and add selected ones
    formData.delete("interests");
    selectedInterests.forEach((interest) => {
      formData.append("interests", interest);
    });

    const result = await registerStudent(formData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push("/login?registered=true");
    }
  }

  function toggleInterest(tag: string) {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-violet-50 via-white to-purple-50 p-4">
      <button
        onClick={() => router.push("/")}
        className="self-start mb-4 p-2 rounded-lg hover:bg-violet-100 transition-colors"
        title="Go back to home"
      >
        <ArrowLeft className="h-5 w-5 text-violet-600" />
      </button>
      <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="p-2.5 bg-violet-100 rounded-xl">
              <Sparkles className="h-6 w-6 text-violet-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">MeetMatch</h1>
          <p className="text-muted-foreground mt-1">Create your student account</p>
        </div>

        <Card className="shadow-lg border-0 shadow-violet-100/50">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-center">Student Registration</CardTitle>
            <CardDescription className="text-center">
              Join MeetMatch to discover and register for campus events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100"
                >
                  {error}
                </motion.div>
              )}

              {/* NO ROLE FIELD - Security: Always registers as student */}

              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    placeholder="John Doe"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@student.com"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Your Interests (for personalized recommendations)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                  {INTEREST_TAGS.map((tag) => (
                    <div key={tag} className="flex items-center space-x-2">
                      <Checkbox
                        id={`reg-${tag}`}
                        checked={selectedInterests.includes(tag)}
                        onCheckedChange={() => toggleInterest(tag)}
                      />
                      <Label htmlFor={`reg-${tag}`} className="text-sm cursor-pointer">
                        {tag}
                      </Label>
                    </div>
                  ))}
                </div>
                {selectedInterests.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {selectedInterests.length} interests selected
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  "Creating Account..."
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" /> Create Account
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-violet-600 font-medium hover:underline">
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Only student registration is available. HOD accounts are created by Admins.
        </p>
      </motion.div>
      </div>
    </div>
  );
}

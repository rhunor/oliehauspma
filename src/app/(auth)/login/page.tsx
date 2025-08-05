"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loginSchema, type LoginData } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginData) => {
    try {
      setIsLoading(true);

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError("root", {
          message: result.error,
        });
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: result.error,
        });
        return;
      }

      const session = await getSession();
      
      toast({
        variant: "success",
        title: "Welcome back!",
        description: "You have been successfully logged in.",
      });

      if (session?.user?.role === "super_admin") {
        router.push("/admin");
      } else if (session?.user?.role === "project_manager") {
        router.push("/manager");
      } else if (session?.user?.role === "client") {
        router.push("/client");
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "An unexpected error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-500 via-primary-600 to-secondary-500 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-primary-600 font-bold text-xl">O</span>
            </div>
            <div>
              <h1 className="text-white text-2xl font-serif font-bold">OliveHaus</h1>
              <p className="text-primary-100 text-sm">Project Management</p>
            </div>
          </div>
          
          <div className="max-w-md">
            <h2 className="text-white text-4xl font-serif font-bold mb-6 leading-tight">
              Streamline Your Interior Design Projects
            </h2>
            <p className="text-primary-100 text-lg leading-relaxed">
              Manage projects, communicate with clients, and track progress all in one elegant platform designed for OliveHaus Interior.
            </p>
          </div>
        </div>

        <div className="text-primary-100 text-sm">
          <p>© 2025 OliveHaus Interior. All rights reserved.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-neutral-50">
        <div className="w-full max-w-md">
          <Card className="shadow-elegant border-0">
            <CardHeader className="text-center pb-8">
              <div className="w-16 h-16 bg-primary-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">O</span>
              </div>
              <CardTitle className="text-2xl font-serif text-gray-900">
                Welcome Back
              </CardTitle>
              <CardDescription className="text-neutral-600">
                Sign in to your OliveHaus PPMA account
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <Input
                    {...register("email")}
                    type="email"
                    label="Email Address"
                    placeholder="Enter your email"
                    leftIcon={<Mail className="h-4 w-4" />}
                    error={errors.email?.message}
                    disabled={isLoading}
                    autoComplete="email"
                    required
                  />
                </div>

                <div>
                  <Input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    label="Password"
                    placeholder="Enter your password"
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="hover:text-gray-600 transition-colors"
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    }
                    error={errors.password?.message}
                    disabled={isLoading}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center">
                    <input
                      {...register("remember")}
                      type="checkbox"
                      className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                      disabled={isLoading}
                    />
                    <span className="ml-2 text-sm text-neutral-600">
                      Remember me
                    </span>
                  </label>

                  <button
                    type="button"
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                    disabled={isLoading}
                  >
                    Forgot password?
                  </button>
                </div>

                {errors.root && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{errors.root.message}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 text-base font-medium"
                  disabled={isLoading}
                  loading={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm text-neutral-600">
                  Need access to the system?{" "}
                  <span className="text-primary-600 font-medium">
                    Contact your administrator
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {process.env.NODE_ENV === "development" && (
            <Card className="mt-6 border-dashed border-2 border-neutral-300">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-neutral-700 mb-2">
                  Demo Credentials
                </h4>
                <div className="space-y-2 text-xs text-neutral-600">
                  <div>
                    <strong>Super Admin:</strong> admin@olivehaus.com / password123
                  </div>
                  <div>
                    <strong>Project Manager:</strong> manager@olivehaus.com / password123
                  </div>
                  <div>
                    <strong>Client:</strong> client@olivehaus.com / password123
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
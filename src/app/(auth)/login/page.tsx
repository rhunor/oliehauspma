"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loginSchema, type LoginData } from "@/lib/validation";
import { useToast } from "@/hooks/use-toast";
import { CDN_IMAGES } from "@/constants/cdn";

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

  const onSubmit = async (data: LoginData): Promise<void> => {
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
      {/* Left Side - Login Form (visible on all screens) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-pale-oat p-6 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo - Links to olivehausinteriors.com */}
          <Link 
            href="https://olivehausinteriors.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 group block"
            aria-label="Visit OliveHaus Interiors website"
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
              className="relative flex flex-col items-start"
            >
              <h1 className="font-bold text-3xl lg:text-4xl tracking-wide text-gray-900 relative">
                <span className="text-luxury-gold">OLIVE</span>
                <span>HAUS</span>
                
                {/* Elegant Underline */}
                <motion.div
                  className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-luxury-gold via-yellow-400 to-luxury-gold"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1, delay: 0.5 }}
                  style={{ transformOrigin: 'left' }}
                />
                
                {/* Decorative dots */}
                <motion.div
                  className="absolute -bottom-1 left-0 w-1 h-1 bg-luxury-gold rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 1 }}
                />
                <motion.div
                  className="absolute -bottom-1 right-0 w-1 h-1 bg-luxury-gold rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 1.2 }}
                />
              </h1>
              <p className="text-xs lg:text-sm font-light tracking-[0.3em] uppercase text-gray-700 opacity-80 mt-1">
                &nbsp;INTERIORS
              </p>
              {/* Always visible website link indicator */}
              <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1 group-hover:text-gray-700 transition-colors">
                <span>Go back to the website</span>
                <motion.span
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  →
                </motion.span>
              </p>
            </motion.div>
          </Link>

          {/* Welcome Text */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Welcome back!</h2>
            <p className="mt-2 text-gray-600">
              Your work, your team, your flow — all in one place.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  {...register("email")}
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10 bg-white border-mist-grey focus:border-soft-sage focus:ring-soft-sage"
                  disabled={isLoading}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  className="pl-10 pr-10 bg-white border-mist-grey focus:border-soft-sage focus:ring-soft-sage"
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  {...register("remember")}
                  type="checkbox"
                  className="rounded border-gray-300 text-soft-sage focus:ring-soft-sage"
                  disabled={isLoading}
                />
                <span className="ml-2 text-sm text-gray-700">Remember me</span>
              </label>

              <button
                type="button"
                className="text-sm text-gray-700 hover:text-gray-900 font-medium"
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>

            {/* Error Message */}
            {errors.root && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-600">{errors.root.message}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-medium bg-soft-sage hover:bg-soft-sage/90 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Log In"
              )}
            </Button>
          </form>

          {/* Contact Admin */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Need access to the system?{" "}
              <button
                type="button"
                className="font-medium text-gray-900 hover:text-gray-700"
              >
                Contact Administrator
              </button>
            </p>
          </div>

          {/* Development Credentials - Only shown in development */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 border-2 border-dashed border-mist-grey rounded-lg bg-warm-sand/30 p-4">
              <h4 className="text-sm font-medium text-gray-800 mb-3">
                Demo Credentials
              </h4>
              <div className="space-y-2 text-xs text-gray-700">
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
            </div>
          )}
        </div>
      </div>

      {/* Right Side - Hero Image (hidden on mobile, visible on desktop) */}
      <div className="hidden lg:block lg:w-1/2 relative bg-soft-sage">
        <Image
          src={CDN_IMAGES.hero.login}
          alt="OliveHaus Interiors"
          fill
          className="object-cover"
          priority
          sizes="50vw"
        />
      </div>
    </div>
  );
}
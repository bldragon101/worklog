import { redirect } from 'next/navigation'

export default function ForgotPasswordPage() {
  // Redirect to Clerk's password reset page
  redirect('/sign-in?redirect_url=/overview')
} 
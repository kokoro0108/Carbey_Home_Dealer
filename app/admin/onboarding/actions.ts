'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireFeature } from '@/lib/auth/session'
import { updateTaskStatus, ensureOnboardingTasks } from '@/lib/portal/onboarding'
import type { OnboardingTaskStatus } from '@/types/database'

const STATUSES: OnboardingTaskStatus[] = ['todo', 'in_progress', 'done']

/** タスクの状態を変更する（本部）。 */
export async function setTaskStatusAction(formData: FormData) {
  await requireFeature('members')
  const taskId = String(formData.get('task_id') ?? '')
  const memberId = String(formData.get('member_id') ?? '')
  const status = String(formData.get('status') ?? '') as OnboardingTaskStatus
  if (!taskId || !memberId || !STATUSES.includes(status)) redirect('/admin/onboarding')

  await updateTaskStatus(taskId, status)
  revalidatePath(`/admin/onboarding/${memberId}`)
  redirect(`/admin/onboarding/${memberId}`)
}

/** 加盟店に既定タスクが無ければ生成する。 */
export async function seedTasksAction(formData: FormData) {
  await requireFeature('members')
  const memberId = String(formData.get('member_id') ?? '')
  if (!memberId) redirect('/admin/onboarding')
  await ensureOnboardingTasks(memberId)
  revalidatePath(`/admin/onboarding/${memberId}`)
  redirect(`/admin/onboarding/${memberId}`)
}

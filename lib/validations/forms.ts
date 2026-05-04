import { z } from 'zod'

const RESERVED_KEYS = new Set(['email', 'first_name', 'last_name', 'unsubscribe_url', 'confirm_url'])

export const formFieldTypeSchema = z.enum(['email', 'text', 'checkbox', 'select'])

export const formFieldSchema = z
  .object({
    id: z.string().min(1),
    key: z
      .string()
      .min(1, 'Field key is required')
      .max(64, 'Field key too long')
      .regex(/^[a-z][a-z0-9_]*$/, 'Field key must be snake_case starting with a letter'),
    label: z.string().min(1, 'Field label is required').max(120),
    type: formFieldTypeSchema,
    required: z.boolean(),
    options: z.array(z.string().min(1).max(120)).max(50).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'select') {
      if (!field.options || field.options.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select fields require at least one option',
          path: ['options'],
        })
      }
    } else if (field.options && field.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Options are only valid for select fields',
        path: ['options'],
      })
    }
    if (field.type === 'email' && field.key !== 'email') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The email field must use key 'email'",
        path: ['key'],
      })
    }
  })

const blockSchema = z.object({
  id: z.string(),
  type: z.enum(['heading', 'text', 'image', 'button', 'divider', 'spacer']),
  props: z.record(z.unknown()),
})

const baseFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  listId: z.string().uuid('Valid list is required'),
  providerId: z.string().uuid().nullable().optional(),
  fromName: z.string().max(120).optional().default(''),
  fromEmail: z.union([z.string().email('Valid from email required'), z.literal('')]).optional().default(''),
  fields: z
    .array(formFieldSchema)
    .min(1, 'At least the email field is required')
    .superRefine((fields, ctx) => {
      const emailField = fields.find((f) => f.type === 'email')
      if (!emailField) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A field with type "email" is required',
          path: [],
        })
        return
      }
      if (!emailField.required) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Email field must be required',
          path: [],
        })
      }
      const keys = new Set<string>()
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i]
        if (keys.has(f.key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate field key: ${f.key}`,
            path: [i, 'key'],
          })
        }
        keys.add(f.key)
        if (f.type !== 'email' && f.type !== 'text' && RESERVED_KEYS.has(f.key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Reserved key: ${f.key}`,
            path: [i, 'key'],
          })
        }
      }
    }),
  doubleOptIn: z.boolean(),
  confirmationSubject: z.string().max(200).optional().default(''),
  confirmationTemplateJson: z.array(blockSchema).optional().default([]),
  successMessage: z.string().min(1).max(500),
  redirectUrl: z
    .string()
    .url('Redirect URL must be a valid URL')
    .max(2048)
    .nullable()
    .optional(),
})

export const createFormSchema = baseFormSchema.superRefine((data, ctx) => {
  if (data.doubleOptIn) {
    if (!data.providerId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provider is required for double opt-in', path: ['providerId'] })
    }
    if (!data.fromEmail) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'From email is required for double opt-in', path: ['fromEmail'] })
    }
    if (!data.confirmationSubject) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Confirmation subject is required for double opt-in', path: ['confirmationSubject'] })
    }
    if (!data.confirmationTemplateJson || data.confirmationTemplateJson.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Confirmation email template is required for double opt-in',
        path: ['confirmationTemplateJson'],
      })
    }
  }
  if (data.redirectUrl) {
    try {
      const u = new URL(data.redirectUrl)
      if (u.protocol !== 'https:' && u.protocol !== 'http:') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Redirect URL must use http or https', path: ['redirectUrl'] })
      }
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Redirect URL is invalid', path: ['redirectUrl'] })
    }
  }
})

export const updateFormSchema = createFormSchema

export const formSubmissionSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Valid email is required')
    .transform((s) => s.trim().toLowerCase()),
  fields: z.record(z.string()).optional().default({}),
  honeypot: z.string().optional(),
})

export type CreateFormInput = z.infer<typeof createFormSchema>
export type UpdateFormInput = z.infer<typeof updateFormSchema>
export type FormSubmissionInput = z.infer<typeof formSubmissionSchema>

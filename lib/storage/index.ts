import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function trimmedEnv(name: string): string | undefined {
  const value = process.env[name]
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

const endpoint = trimmedEnv('S3_ENDPOINT')
const region = trimmedEnv('S3_REGION') || 'us-east-1'
const accessKeyId = trimmedEnv('S3_ACCESS_KEY_ID')
const secretAccessKey = trimmedEnv('S3_SECRET_ACCESS_KEY')
const BUCKET = trimmedEnv('S3_BUCKET')

if (!accessKeyId || !secretAccessKey || !BUCKET) {
  console.warn('[storage] Missing S3 config: S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_BUCKET are required.')
}

const client = new S3Client({
  region,
  ...(endpoint ? { endpoint } : {}),
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || '',
  },
})

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }))
  return key
}

export async function getPresignedUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn })
}

export async function getFile(key: string) {
  const response = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
  return {
    body: response.Body,
    contentType: response.ContentType || 'application/octet-stream',
    contentLength: response.ContentLength,
  }
}

export async function deleteFile(key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

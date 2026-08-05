import type { NextApiRequest, NextApiResponse } from 'next'
import nookies from 'nookies'

import { mapToConnected, mapToToken } from '@flow/reader/sync'

import { dbx } from '../utils'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (
    typeof req.query.state !== 'string' ||
    typeof req.query.code !== 'string'
  ) {
    return res.status(400).end()
  }

  const state = JSON.parse(req.query.state)

  const response = await dbx.auth.getAccessTokenFromCode(
    state.redirectUri,
    req.query.code,
  )
  const result = response.result as any

  const maxAge = 365 * 24 * 60 * 60
  // httpOnly so ePub-borne XSS in the render iframe cannot read the token.
  nookies.set({ res }, mapToToken['dropbox'], result.refresh_token, {
    maxAge,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  })
  // Readable companion flag for the client UI (carries no secret).
  nookies.set({ res }, mapToConnected['dropbox'], '1', {
    maxAge,
    secure: true,
    sameSite: 'lax',
    path: '/',
  })

  // https://stackoverflow.com/questions/4694089/sending-browser-cookies-during-a-302-redirect
  res.redirect(302, '/success')
}

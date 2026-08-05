import type { NextApiRequest, NextApiResponse } from 'next'
import { destroyCookie } from 'nookies'

import { mapToConnected, mapToToken } from '@flow/reader/sync'

// Clears the httpOnly refresh-token cookie (which client JS cannot delete) plus
// its readable companion, ending the Dropbox link.
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  destroyCookie({ res }, mapToToken['dropbox'], { path: '/' })
  destroyCookie({ res }, mapToConnected['dropbox'], { path: '/' })
  res.status(204).end()
}

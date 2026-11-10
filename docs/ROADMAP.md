# Roadmap, not code

These two pieces existed in Telerave-v2 only as unfinished code. They are not part of Lume yet. This note is the decision, so they are not treated as missing product work.

## CDN offload

The old service could upload a video buffer to S3-compatible storage and remember the public URL. Nothing called it, and the request signature was incomplete.

If we pick it up later, it should be an optional cache for popular HLS segments: `CDN_ENDPOINT`, `CDN_BUCKET`, `CDN_ACCESS_KEY`, `CDN_SECRET_KEY`, `CDN_REGION`, `CDN_PUBLIC_URL`. Unsigned or half-signed uploads stay out.

## P2P segment mesh

The old client had a WebRTC data-channel mesh and a service worker, and the server relayed signalling. The client never registered that worker, so no bytes moved.

A later version can share HLS segments between viewers in the same room, drop private ICE candidates, and stay behind a flag. Until then Lume does not ship the mesh.

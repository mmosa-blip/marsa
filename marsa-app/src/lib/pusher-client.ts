import PusherClient from "pusher-js";

const key = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap2";

export const pusherClient = key
  ? new PusherClient(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    })
  : (null as unknown as PusherClient);

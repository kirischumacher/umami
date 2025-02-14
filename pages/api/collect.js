const { Resolver } = require('dns').promises;
import isbot from 'isbot';
import ipaddr from 'ipaddr.js';
import { createToken, unauthorized, send, badRequest, forbidden } from 'next-basics';
import { savePageView, saveEvent } from 'queries';
import { useCors, useSession } from 'lib/middleware';
import { getJsonBody, getIpAddress } from 'lib/request';
import { secret, uuid } from 'lib/crypto';

export default async (req, res) => {
  await useCors(req, res);

  if (isbot(req.headers['user-agent']) && !process.env.DISABLE_BOT_CHECK) {
    return unauthorized(res);
  }

  const ignoreIps = process.env.IGNORE_IP;
  const ignoreHostnames = process.env.IGNORE_HOSTNAME;

  if (
    (ignoreIps || ignoreHostnames) &&
    req.body.payload.website === 'e58f854e-7b7a-4ddb-840b-361ca39060cf'
  ) {
    const ips = [];

    if (ignoreIps) {
      ips.push(...ignoreIps.split(',').map(n => n.trim()));
    }

    if (ignoreHostnames) {
      const resolver = new Resolver();
      const promises = ignoreHostnames
        .split(',')
        .map(n => resolver.resolve4(n.trim()).catch(() => {}));

      await Promise.all(promises).then(resolvedIps => {
        ips.push(...resolvedIps.filter(n => n).flatMap(n => n));
      });
    }

    const clientIp = getIpAddress(req);

    const blocked = ips.find(ip => {
      if (ip === clientIp) return true;

      // CIDR notation
      if (ip.indexOf('/') > 0) {
        const addr = ipaddr.parse(clientIp);
        const range = ipaddr.parseCIDR(ip);

        if (addr.kind() === range[0].kind() && addr.match(range)) return true;
      }

      return false;
    });

    if (blocked) {
      return forbidden(res);
    }
  }

  await useSession(req, res);

  const {
    session: { website_id, session_id, session_uuid },
  } = req;

  const { type, payload } = getJsonBody(req);

  let { url, referrer, event_name, event_data } = payload;

  if (process.env.REMOVE_TRAILING_SLASH) {
    url = url.replace(/\/$/, '');
  }

  const event_uuid = uuid();

  if (type === 'pageview') {
    await savePageView(website_id, { session_id, session_uuid, url, referrer });
  } else if (type === 'event') {
    await saveEvent(website_id, {
      event_uuid,
      session_id,
      session_uuid,
      url,
      event_name,
      event_data,
    });
  } else {
    return badRequest(res);
  }

  const token = createToken({ website_id, session_id, session_uuid }, secret());

  return send(res, token);
};

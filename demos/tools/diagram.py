# Builds the inline SVG for the 4eyez architecture diagram (themed by the site's CSS variables).
CW = 5.75  # IBM Plex Mono advance at 9.5px
def chips(names, x0, y0, maxw, cls="chip"):
    out, x, y = [], x0, y0
    for n in names:
        w = len(n) * CW + 12
        if x + w > x0 + maxw: x, y = x0, y + 22
        hl = ' dg-hl' if n == 'attendanceItem' else ''
        out.append(f'<rect class="dg-chip{hl}" x="{x:.1f}" y="{y}" width="{w:.1f}" height="17"/><text class="dg-mono{hl}" x="{x+6:.1f}" y="{y+12}">{n}</text>')
        if n == 'attendanceItem': pos = (x + w/2, y + 17)
        x += w + 5
    return '\n'.join(out), y, locals().get('pos')
tables = ['Person','Student','Guardian','Volunteer','Admin','Meeting','Event','eventType','MeetingSignUpItem','NoteItem','smallGroup','attendanceItem']
tch, ty, att = chips(tables, 96, 262, 272)
mysql_h = ty + 17 + 14 - 210
redis_y = 210 + mysql_h + 30
mongo_y = redis_y + 92 + 22
H = mongo_y + 92 + 8
svg = f'''<svg class="diagram" viewBox="0 0 400 {H}" role="img" aria-labelledby="dg-t dg-d">
<title id="dg-t">“4eyez” architecture</title>
<desc id="dg-d">Admins and leaders call a FastAPI service over REST and GraphQL. It stores people, meetings, events and sign-ups in MySQL, tracks live check-in in Redis sets that are written to MySQL attendance when an event ends, and keeps custom event fields in MongoDB Atlas.</desc>
<defs><marker id="dg-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="dg-head"/></marker>
<marker id="dg-arr-a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L8 4L0 8z" class="dg-head-a"/></marker></defs>
<rect class="dg-box" x="110" y="6" width="180" height="46"/>
<text class="dg-sans" x="200" y="26" text-anchor="middle">Admins &amp; leaders</text>
<text class="dg-mono dg-muted" x="200" y="42" text-anchor="middle">HTTP clients</text>
<path class="dg-line" d="M200 52V82" marker-end="url(#dg-arr)"/>
<rect class="dg-box dg-strong" x="30" y="86" width="340" height="96"/>
<text class="dg-mono dg-muted" x="358" y="102" text-anchor="end">DOCKER · UVICORN</text>
<text class="dg-serif" x="46" y="114">FastAPI service</text>
<rect class="dg-chip" x="46" y="132" width="178" height="34"/><text class="dg-mono dg-b" x="56" y="146">REST</text><text class="dg-mono dg-muted" x="56" y="159">/events /people /attendance</text>
<rect class="dg-chip" x="232" y="132" width="122" height="34"/><text class="dg-mono dg-b" x="242" y="146">GraphQL</text><text class="dg-mono dg-muted" x="242" y="159">/graphql</text>
<path class="dg-line" d="M58 182V{mongo_y+40}"/>
<path class="dg-line" d="M58 {210+30}H78" marker-end="url(#dg-arr)"/>
<path class="dg-line" d="M58 {redis_y+30}H78" marker-end="url(#dg-arr)"/>
<path class="dg-line" d="M58 {mongo_y+40}H78" marker-end="url(#dg-arr)"/>
<rect class="dg-box" x="82" y="210" width="300" height="{mysql_h}"/>
<text class="dg-serif" x="96" y="236">MySQL</text><text class="dg-mono dg-muted" x="368" y="232" text-anchor="end">RELATIONAL CORE</text>
<text class="dg-mono dg-muted" x="96" y="252">people, roles, meetings, sign-ups</text>
{tch}
<rect class="dg-box" x="82" y="{redis_y}" width="300" height="92"/>
<text class="dg-serif" x="96" y="{redis_y+26}">Redis</text><text class="dg-mono dg-muted" x="368" y="{redis_y+22}" text-anchor="end">LIVE CHECK-IN</text>
<text class="dg-mono" x="96" y="{redis_y+48}">SADD event:{{id}}:checkedIn</text>
<text class="dg-mono dg-muted" x="96" y="{redis_y+64}">check in · check out · live count</text>
<text class="dg-mono dg-muted" x="96" y="{redis_y+80}">one set per running event</text>
<path class="dg-line dg-accent" d="M{att[0]:.1f} {redis_y}V{att[1]+4:.1f}" marker-end="url(#dg-arr-a)"/>
<text class="dg-mono dg-acc" x="{att[0]+8:.1f}" y="{redis_y-9}">end_event → write attendance</text>
<rect class="dg-box" x="82" y="{mongo_y}" width="300" height="92"/>
<text class="dg-serif" x="96" y="{mongo_y+26}">MongoDB Atlas</text><text class="dg-mono dg-muted" x="368" y="{mongo_y+22}" text-anchor="end">CUSTOM FIELDS</text>
<text class="dg-mono" x="96" y="{mongo_y+48}">eventTypes · eventCustomData</text>
<text class="dg-mono dg-muted" x="96" y="{mongo_y+64}">each event type defines its own fields</text>
<text class="dg-mono dg-muted" x="96" y="{mongo_y+80}">values keyed by meetId</text>
</svg>'''
open(__import__('sys').argv[1], 'w').write(svg)
print(H, att)

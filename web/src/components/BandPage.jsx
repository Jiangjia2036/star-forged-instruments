import { useState } from "react";

import { BAND, MEMBERS } from "../band";

// Falls back to a lettered placeholder when an image is missing, so the
// layout still reads properly before the photos are taken.
function Portrait({ src, alt, fallback, className }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    if (!fallback) return null;

    return (
      <div className={className + " portrait-empty"}>
        <span>{fallback}</span>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

function BandPage() {
  return (
    <div className="page">
      <div className="page-head">
        <h2 className="page-title">{BAND.name}</h2>
        <p className="page-sub">{BAND.tagline}</p>
      </div>

      <div className="panel">
        <Portrait
          src={BAND.photo}
          alt={BAND.name}
          fallback="Band photo goes here"
          className="band-photo"
        />

        <p className="card-body band-blurb">{BAND.blurb}</p>
      </div>

      <div className="panel">
        <h3 className="panel-title band-members-title">The band</h3>

        <div className="member-grid">
          {MEMBERS.map((member) => (
            <article key={member.name} className="member">
              <Portrait
                src={member.photo}
                alt={member.name}
                fallback=""
                className="member-photo"
              />

              <h4 className="card-title">{member.name}</h4>
              <div className="card-tag">{member.role}</div>
              <p className="card-body">{member.bio}</p>

              {member.linkedin ? (
                <a
                  className="linkedin-link"
                  href={member.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="linkedin-mark">in</span>
                  LinkedIn profile
                </a>
              ) : (
                <div className="linkedin-link linkedin-placeholder">
                  <span className="linkedin-mark">in</span>
                  Add LinkedIn URL in band.js
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export default BandPage;

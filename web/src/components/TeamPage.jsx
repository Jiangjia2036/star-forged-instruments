import "./TeamPage.css";

// `onBack` is optional. Standalone (as on the team-info-page branch) it
// renders its own header with a back button. Embedded in a layout that
// already has navigation, omit it and the header is skipped so the title
// and controls are not duplicated.
function TeamPage({ onBack }) {
  const teamMembers = [
    {
      name: "Ethan Summers",
      role: "Hardware / Pico",
      description:
        "Worked on the physical instrument, electronics, and Pico integration.",
      image: "https://placehold.co/300x300",
    },
    {
      name: "Grayson Pressutti",
      role: "Audio / DSP",
      description:
        "Worked on sound generation, audio processing, and instrument effects.",
      image: "/photos/Grayson.jpg",
    },
    {
      name: "Alejandro Padilla",
      role: "Web / UI",
      description:
        "Worked on the interactive website, user interface, and Pico-Web integration.",
      image: "/photos/Alejandro.png",
    },
    {
      name: "Jiaxiong Jiang",
      role: "3D / Visuals",
      description:
        "Worked on the 3D visualizer, instrument design, and visual presentation.",
      image:"/photos/Jiaxiong.jpeg"
    },
  ];

  return (
    <div className="team-page">

      {onBack && (
        <header className="team-header">

          <button
            className="back-btn"
            onClick={onBack}
          >
            ← Instrument
          </button>

          <h1>Star Forged Instruments</h1>

        </header>
      )}

      <main className="team-content">

        <section className="team-intro">

          <p className="team-label">
            HACK 2026
          </p>

          <h2>
            Meet the Team
          </h2>

          <p>
            We are Star Forged, an interactive
            musical instrument combining hardware,
            software, sound, and visual effects.
          </p>

        </section>

        <section className="team-photo-section">

          <div className="team-photo-placeholder">

            <span>
              TEAM PHOTO
            </span>

            <p>
              Our team photo will go here
            </p>

          </div>

        </section>

        <section className="members-section">

          <div className="section-heading">

            <p className="team-label">
              THE CREW
            </p>

            <h2>
              Our Team
            </h2>

          </div>

          <div className="members-grid">

            {teamMembers.map((member) => (
              <article
                className="member-card"
                key={member.name}
              >

                <img
                  src={member.image}
                  alt={member.name}
                  className="member-image"
                />

                <div className="member-info">

                  <h3>
                    {member.name}
                  </h3>

                  <p className="member-role">
                    {member.role}
                  </p>

                  <p className="member-description">
                    {member.description}
                  </p>

                </div>

              </article>
            ))}

          </div>

        </section>

        <section className="project-section">

          <h2>
            Our Project
          </h2>

          <p>
            Star Forged Instruments combines a
            Raspberry Pi Pico, web technologies,
            electronic sound generation, and
            interactive visuals into one musical
            instrument.
          </p>

          <div className="tech-list">

            <span>Raspberry Pi Pico</span>
            <span>React</span>
            <span>Web Serial</span>
            <span>Web Audio</span>
            <span>Three.js</span>

          </div>

        </section>

      </main>

    </div>
  );
}

export default TeamPage;
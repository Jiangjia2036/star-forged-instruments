import "./TeamPage.css";

function TeamPage({ onBack }) {
  const teamMembers = [
    {
      name: "Ethan Summers",
      role: "Circuit design / Soldering / Assembly", 
      description:
        "Hello! I'm Ethan Summers and I am majoring in Mechanical Engineering. I'm a transfer from West Valley Community College from San Jose. I hope you enjoy our interstellar instrument! ",
      image:
        "/photos/Ethan.jpg",
    },
    {
      name: "Grayson Pressutti",
      role: "CAD Design / Assembly",
      description:
        "Hi, I'm Grayson Pressutti! I'm a mechanical engineering major transferring from Clovis Community College in Fresno. I'm a percussionist, and I've been getting better at art and music production in my spare time!",
      image:
        "/photos/Grayson.jpg",
    },
    {
      name: "Alejandro Padilla",
      role: "Web-Pico Integration / Code Design",
      description:
        "My name is Alejandro Padilla, I'm a transfer from Mt. San Antonio College. I am currently majoring in Electrical Engineering. Currently what I like to do is larp on insta & Linkedin and mostly doing whatever is interesting.",
      image:
        "/photos/Alejandro.png",
    },
    {
      name: "Jiaxiong Jiang",
      role: "Website / Graphic Design",
      description:
        "My name is Jiaxiong Jiang, a transfer from Skyline college which locate in Bay Area. I am majoring in Computer engineering. I like to play games and play the guitar in my free time.",
      image:
        "/photos/Jiaxiong.jpeg",
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

          <h1>
            Meet the Team
          </h1>
        </header>
      )}

      <main className="team-content">
        <section className="team-intro">
          <p className="team-label">
            HACK 2026
          </p>

          <h2>
            Star Forged
          </h2>

          <p>
            We are Star Forged, a team of four transfer students joining UCLA in Fall 2026. We came together through the 2026 HACK to combine our different skills and build something we could bring to the competition. This instrument is our project for the 2026 HACK, where we challenged ourselves to turn our ideas into a working interactive experience.
          </p>
        </section>

          <section className="team-photo-section">
            <div className="team-photo-placeholder">
              <img
                src="/photos/UCLA_HACK2026_StarForged.JPG"
                alt="Star Forged team"
              />
            </div>
          </section>

        <section className="members-section">
          <div className="section-heading">
            <h2>
              The Crew
            </h2>
          </div>

          <div className="members-grid">
            {teamMembers.map(
              (member) => (
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
              )
            )}
          </div>
        </section>

        <section className="project-section">
          <h2>
            Our Project
          </h2>

          <p>
            Our project is an interactive UFO-shaped musical instrument that bridges physical hardware with a web-based interface. Our system integrates a Raspberry Pi Pico for real-time hardware control with a React-based web interface, using Web Serial for communication between the instrument and browser. It combines real-time note input, customizable scales and octaves, sound effects, song playback, and interactive visual feedback powered by Web Audio and Three.js to create an engaging and immersive musical experience.
          </p>

          <div className="tech-list">
            <span>
              Raspberry Pi Pico
            </span>

            <span>
              React
            </span>

            <span>
              Web Serial
            </span>

            <span>
              Web Audio
            </span>

            <span>
              Three.js
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default TeamPage;
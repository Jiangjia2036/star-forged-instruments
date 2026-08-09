"""USB serial to the website.

Same newline protocol as before, so the site needs no changes. print() goes
out over the CDC console; input is polled non-blocking via supervisor.
"""

import sys

import supervisor


class SerialLink:
    def __init__(self):
        self._rx = ""

    def send(self, line):
        print(line)

    def poll(self):
        """Yield each complete inbound line. Never blocks."""

        # Bounded per call so a burst cannot stall the main loop
        for _ in range(64):
            if not supervisor.runtime.serial_bytes_available:
                return

            ch = sys.stdin.read(1)
            if not ch:
                return

            if ch == "\n":
                line = self._rx.strip()
                self._rx = ""
                if line:
                    yield line

            elif ch != "\r":
                self._rx += ch

                # Discard runaway garbage rather than growing forever
                if len(self._rx) > 80:
                    self._rx = ""

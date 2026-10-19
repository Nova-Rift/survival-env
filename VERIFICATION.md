# Verification

Independent checkout: 16 tests passed using the available legacy runtime. The README example command(s) ran successfully; baseline output was redirected to a fresh temporary directory. Isolation tests raise on imports from the other repository. No dependency installation, training experiment, model download, GPU, engine or paid resource was used.

Python 3.10.12 / NumPy 1.26.4. Agent checks additionally used Torch 2.2.0+cu121 and safetensors 0.4.5 on CPU. These old ML versions have known advisories. Recommended newer dependency resolution and installation are untested. No security certification is claimed. README dependency-install descriptions are prerequisites, not executed installation tests.

Publication verified on 2026-10-19: both canonical repositories are public; all 18 environment files and 30 agent files at their extraction commits matched anonymous downloads byte-for-byte. Remote main branches matched the prepared source commits. Reciprocal repository URLs resolve. This publication record is a documentation-only follow-up; source pins in the integration repository retain the tested extraction commits. Source extraction came from survival-agent-pilot commit be2e3f43b972a6cd83b0f31f420abdfd3b3a7f1e. Prior development history is retained there. The source-only extraction excludes models, checkpoints and private artifacts.

Browser preparation: 24 Node tests passed on Node 22.22.2, including 18
Python-derived scenarios with 106 transitions and 90 recorded random draws.
Full frames, float32 local observations, rewards, terminal flags and spawn
candidate sets match when both runtimes receive identical random choices.
Fixture regeneration matched Python 3.10.12 / NumPy 1.26.4 output exactly, and
all 16 existing Python tests still passed. The canonical Python simulator was
unchanged. The scripted JS smoke example produced three ticks and reward six
and cleared episode memory; it performed no learning. No dependencies were
installed. This does not establish NumPy/JS same-seed identity, browser runtime
compatibility, browser performance, model export parity or trained behavior.
The supported browser inventory was empty; no website visual check was possible.
No live demo, model, deployment or integration-repository source pin was changed.

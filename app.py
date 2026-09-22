import json
from pathlib import Path

import streamlit as st


ROOT = Path(__file__).resolve().parent
MODEL_PATH = ROOT / "model" / "model.json"


@st.cache_data
def load_model():
    if not MODEL_PATH.exists():
        return None
    return json.loads(MODEL_PATH.read_text(encoding="utf-8"))


def pair_key(a, b):
    return f"{a}|{b}"


def candidate_effects(candidate, side, allies, enemies, model):
    """Break the relative own-side log-odds change into the three model effects."""
    own_sign = 1 if side == "Attack" else -1
    attack_main = model["attack_main"].get(candidate, 0.0)
    defense_main = model["defense_main"].get(candidate, 0.0)
    base = own_sign * (attack_main if side == "Attack" else defense_main)

    ally_key = "attack_ally" if side == "Attack" else "defense_ally"
    ally_weights = model[ally_key]
    synergy = 0.0
    for ally in allies:
        synergy += own_sign * ally_weights.get(pair_key(*sorted((candidate, ally))), 0.0)

    # Matchup feature orientation always means attack operator vs defense operator.
    matchup = 0.0
    for enemy in enemies:
        key = pair_key(candidate, enemy) if side == "Attack" else pair_key(enemy, candidate)
        matchup += own_sign * model["matchup"].get(key, 0.0)
    return {"base": base, "matchup": matchup, "synergy": synergy, "total": base + matchup + synergy}


st.set_page_config(page_title="R6 Draft Pick Helper", page_icon="🎯", layout="wide")
st.title("Rainbow Six Siege · Draft Pick Helper")
st.caption("A historical, relative ranking aid. It does not predict match win probability.")
model = load_model()
if model is None:
    st.error("No trained model is installed yet.")
    st.markdown("Start with [the setup guide](README.md), then run `python train_model.py --input path\\to\\rounds.csv`.")
    st.stop()

operators = model["operators"]
operators_by_side = model["operators_by_side"]
display_name = lambda op: {"IQ": "IQ", "RESERVE": "Recruit"}.get(op, op.title())
st.caption(f"Model data: {model.get('data_label', 'unspecified')} · {len(operators)} operators")
side = st.radio("Which side has the open slot?", ["Attack", "Defense"], horizontal=True)
opposite_side = "Defense" if side == "Attack" else "Attack"
side_operators = operators_by_side[side.lower()]
enemy_operators = operators_by_side[opposite_side.lower()]
if st.button("Clear draft"):
    for key in ("allies_attack", "allies_defense", "enemies_attack", "enemies_defense", "banned"):
        st.session_state[key] = []
    st.rerun()
left, right = st.columns(2)
allies_key = f"allies_{side.lower()}"
enemies_key = f"enemies_{side.lower()}"
with left:
    allies = st.multiselect("Your side's picks", side_operators, format_func=display_name, key=allies_key)
with right:
    enemies = st.multiselect("Enemy side's picks", enemy_operators, format_func=display_name, key=enemies_key)
unavailable = st.multiselect("Banned operators", operators, format_func=display_name, key="banned")
overlap = set(allies) & set(enemies)
if overlap:
    st.warning("An operator appears on both sides: " + ", ".join(sorted(overlap)))
if set(unavailable) & (set(allies) | set(enemies)):
    st.warning("A banned operator is also listed as picked. It remains excluded from recommendations.")

picked = set(allies) | set(enemies) | set(unavailable)
ranked = sorted(
    ((op, candidate_effects(op, side, allies, enemies, model)) for op in side_operators if op not in picked),
    key=lambda item: item[1]["total"], reverse=True,
)
st.subheader(f"Recommended {side.lower()} picks")
if not ranked:
    st.info("No unpicked, unbanned operators remain in this side's pool.")
else:
    for rank, (op, effects) in enumerate(ranked[:15], 1):
        st.markdown(f"**{rank}. {display_name(op)}** — relative score `{effects['total']:+.3f}`")
        st.caption(f"Base `{effects['base']:+.3f}` · enemy matchup `{effects['matchup']:+.3f}` · ally synergy `{effects['synergy']:+.3f}`")
st.caption("Scores are changes in model log-odds units, shown only to compare available picks. They are not probabilities or win chances.")


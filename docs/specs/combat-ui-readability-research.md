Combat UI Readability Research for The Fractured Road
Why this specific reference set is unusually high-leverage
The fastest path to a “combat UI/UX spike” that changes outcomes is to study games that make different bets about what the player must reliably know before committing an action—not just games that share genre DNA. In practice, the five titles you selected represent five distinct readability philosophies that map cleanly onto a party-RPG tactics slice: (1) telegraphed intent as the game’s core contract, (2) contextual combat forecasting as a continuous HUD service, (3) terrain/verticality legibility as a first-class tactical language, (4) threat maps as a one-button safety truth, and (5) experimentation support via rewinds/undo to reduce planning fear.

Two observations stand out when you anchor this in what the games explicitly claim (and teach) rather than what we “remember” about them:

The most trustworthy tactical UIs don’t just expose information; they stabilize a contract about what information is knowable when (before you act vs. after you commit), and they present it in a way that sustains player trust over hundreds of decisions. For example, Into the Breach frames its combat around the promise that “all enemy attacks are telegraphed,” turning play into counter-planning rather than guesswork. 
“XCOM-style density” is not a visual aesthetic—it’s a product of a very specific promise: the player can preview many consequences (hit odds, damage, flanking, concealment breaks) in the tactical layer before they click. XCOM 2’s manual documents this as a deliberate part of its combat screen design (unit flag details, movement previews, cover states, and shot outcome previews). 
That’s the through-line for The Fractured Road’s spike: build a UI contract that makes the board truthful, terrain truthful, and consequence truthful—then layer flair, speed, and expressiveness on top.

Board truth through intent and threat visualization
Into the Breach’s main UI lesson is not “telegraphs exist”—it’s that telegraphing is treated as the fundamental gameplay proposition. Both Subset’s official copy and platform listings explicitly foreground the rule: “All enemy attacks are telegraphed,” and the player is invited to “analyze your opponent’s attack” and produce the counter-plan. 

That positioning matters for UI/UX because it implies a strict design requirement: you can’t hide intent behind hover tooltips, submenus, or “advanced info.” If enemy intent is the contract, it must be legible at the board level by default (or by a single, low-friction toggle).

Fire Emblem Engage’s comparable contribution is not intent telegraphing per se, but an adjacent truth: “where am I unsafe?” should be answerable immediately. The game’s own official framing emphasizes matchup rules and the “break” outcome (“prevent them from launching a counterattack”) as something you should plan around. 
 In parallel, mainstream guidance highlights that you can reveal enemy threat radii via a controller shortcut (left trigger / ZL) to display enemy ranges—explicitly making threat visualization a first-order planning tool. 

For The Fractured Road, these two ideas combine into a single “board truth” architecture:

Intent layer (per-enemy commitments): what each enemy is about to do, what tiles are targeted, and what secondary effects will land (e.g., knockback destination, pull vectors, AoE footprint). This is the Into the Breach posture: intent is not a mystery to be discovered; it is the problem the player is solving. 
Threat layer (capability envelopes): where enemies can reach/attack if you step there—plus special-case ranges (e.g., support, reactions, overwatch equivalents). This is the Fire Emblem posture: the UI gives the player a quick, global safety read to prevent accidental deaths that feel like UI failure, not tactical failure. 
FE7/8] Enemy Range Display Hack - Resources - Fire Emblem Universe
Tactical Breach Wizards review — A hilarious, varied and accessible  turn-based strategy · Thinky Games

A subtle but important compatibility note: Into the Breach also leans on reduced uncertainty. A prominent developer interview about the game describes how “every enemy attack is telegraphed” and ties that to the feel of a puzzle, explicitly referencing the absence of random chance in attacks as part of that puzzle contract. 
 If The Fractured Road uses hit RNG, variable damage ranges, or conditional reactions, the “intent layer” and “threat layer” can still work—but the UI must communicate uncertainty honestly (probabilities, ranges, and conditions) to preserve trust.

Contextual forecasting and tactical HUD layering
XCOM 2 is the reference here for a reason: it demonstrates how a tactics game can keep many state variables visible without collapsing into a cockpit—by routing them through a few stable UI anchors and consistent interaction patterns.

The manual for XCOM 2 documents several specific UI behaviors that are directly relevant to a Fractured Road “forecast card + overlays” hybrid:

The Unit Flag is explicitly described as the place where you see the selected soldier’s state, including health, armor, action points, cover, overwatch, concealment, and other positive/negative effects. 
Movement previews are formalized: a blue outline indicates movement range for one action point; a yellow outline indicates dash range for spending two action points. 
Concealment break risk is conveyed with a red “eye” icon for tiles within enemy line of sight (entering them breaks concealment). 
Cover is represented with half/full shield icons (low/high cover), and the UI distinguishes flanking states (yellow for currently flanked; red for would-be flanked if you move there). 
When you highlight a target to shoot, the UI previews hit chance, projected damage, and critical hit chance. 
This matters for your spike because it’s a concrete, documented example of forecast-first interaction. The player can explore moves and targets, and the UI continuously answers: “If you do this, what is the likely outcome, what is the risk, and what conditions change?”

For The Fractured Road, the transferable insight is less about copying XCOM’s exact layout and more about preserving a similar information topology:

A single primary “state anchor” (your equivalent of the unit flag) that answers “what is true about me right now?” without forcing tooltips. 
A single primary “consequence anchor” (your forecast card) that answers “what happens if I commit this action?” in a compact, consistent shape—especially for survivability and retaliation. 
Board overlays that communicate range, LoS/permission, and danger as spatial information rather than narrative text. 
One risk your original write-up already flags—and which is real—is that copying “XCOM density” without copying XCOM’s underlying contract can backfire. Tom Francis (writing about early Tactical Breach Wizards prototyping) explicitly calls out enjoying XCOM 2 while also feeling it had “so many clarity problems,” which is a useful warning sign: density doesn’t automatically equal clarity, even in games famous for tactical UI. 

Terrain and verticality as a first-class tactical language
Triangle Strategy demonstrates (and Nintendo’s own materials reinforce) that “terrain matters” only becomes real strategy when the game repeatedly reminds the player that it matters in the moment they make decisions.

Nintendo’s own store copy and guidance emphasize multi-tiered battlefields and explicitly instruct players to position units on higher ground for advantage, flank from both sides, and strike from behind for follow-up attacks. 
 The same Nintendo guidance also describes ladders as a tactical tool to reach higher vantage points, reinforcing that elevation is not a niche edge case but a core movement/positioning problem the UI should support. 

In a Nintendo “devs themselves” feature, developer commentary also foregrounds knockback and height—explicitly describing that “there’s a lot of height in each map” and highlighting the satisfaction of pushing enemies (including off higher ground), implying the game expects players to see and plan around vertical consequences. 

From a UI research standpoint, this yields three concrete “terrain truth” requirements for The Fractured Road if terrain is intended to be strategically meaningful:

Height delta must be easy to read at decision time. If verticality changes range, damage, permission to attack, or knockback outcomes, you need a terrain-aware visualization that does not force the player to do mental arithmetic across tiles. Nintendo’s own Triangle Strategy tips repeatedly stress high ground advantage as a practical tactic, indicating the game expects the player to notice elevation advantages quickly. 
Line-of-fire/obstruction needs spatial feedback. If a shot is blocked by geometry or units, the board should show that blockage as you aim, not after you commit. (Triangle Strategy’s public-facing materials don’t document its LOS rules in the same step-by-step way XCOM’s manual does, but the game is consistently framed as multi-tiered positioning where terrain is decisive, which is exactly the design pressure that produces LOS/obstruction UI requirements.) 
Turn order context matters more when terrain creates “setup turns.” Triangle Strategy’s initiative is communicated as something to watch, and Nintendo explicitly notes that skipping a turn (no move and no commands) reduces time until the unit’s next turn by 20%, highlighting that sequencing and tempo are part of the tactical language. 
If The Fractured Road wants Triangle Strategy–style “terrain expressiveness,” the UI spike should treat terrain as a layer, not a tooltip—because the official guidance repeatedly trains players to search for positional advantages, and UI must keep that search cheap. 

Experimentation support through undo, rewind, and commitment staging
Tactical Breach Wizards is the cleanest modern illustration of a design thesis that is extremely relevant to UI prototyping: reduce planning fear, increase creative iteration, and let the player verify the combat language by trying things.

This isn’t just an interpretation—both developer and store messaging foreground it:

In an early public pitch, Tom Francis states a principle directly: you can “play out a turn as many times as you like before you commit,” rewinding and changing orders until satisfied. 
The store description similarly positions the feature as experimentation support—explicitly encouraging players to rewind when an idea doesn’t pan out, and framing “free rewinds” as a way to test wild plans in-game rather than stalling in analysis. 
Reviews note the mechanical boundary and UX polish: you can undo actions until you commit to ending your turn, and the game warns you to prevent accidental turn-ends. 
Into the Breach offers a related—but importantly more constrained—angle on the same problem: allowing limited reversal to prevent “UI ambiguity punishment.” Contemporary reviews describe being able to undo moves before committing and having the ability to reset an entire turn (in addition to normal move-undo), emphasizing that these affordances mitigate human error under high-stakes tactical pressure. 

For The Fractured Road’s spike, the actionable research takeaway is not “add full infinite rewinds.” It’s that commitment staging is part of the UX contract:

If your UI language is still settling, a bounded undo (or “rewind within planning”) is a quality multiplier because it lets players explore the language until it becomes fluent. 
The more your combat depends on positioning combos, displacement chains, and sequencing, the more the player benefits from being able to test “what if I swap the order?” without paying a large reload tax. Tactical Breach Wizards explicitly sells itself on this loop. 
There’s also a secondary UI-specific signal worth noting: Tactical Breach Wizards’ developers have shipped accessibility/readability tweaks like an optional “Large UI mode” (enabled by default on Steam Deck) to improve readability of ability names and costs. That is direct evidence that, even in a game with rewinds, legibility must still be solved in the core UI layer. 

Synthesis as a combat slice UI architecture
Your original conclusion—don’t average all five; pick a center of gravity—is consistent with what the sources imply. The strongest “The Fractured Road” hybrid is a readability-first stack where the board carries the truth, and panels explain the consequences—without turning the base view into a stats cockpit.

A practical architecture, anchored in the proven contracts above, looks like this:

Core contract for the slice: The player should be able to answer, at all times and with minimal interaction cost:

what enemies intend to do,
where enemies can reach,
what terrain changes permission and outcomes,
what will happen if I commit this action (including retaliation),
what happens if I change the order of actions.
This is the combined contract implied by Into the Breach’s “telegraphed attacks” positioning, XCOM 2’s tactical forecasting UI, Nintendo’s framing of Triangle Strategy’s terrain advantages, Fire Emblem Engage’s official “break” rule emphasis plus common danger-area usage, and Tactical Breach Wizards’ rewind-first experimentation loop. 

Smallest version that still proves the concept (UI spike minimum):

A one-button Threat Mode that overlays enemy threat radii and makes “unsafe tiles” instantly apparent (Fire Emblem–style), even if it’s initially approximate (e.g., ignores rare reactions) as long as the approximation is clearly labeled. 
A persistent Intent Layer that shows targeted tiles/lines and secondary outcomes where relevant (Into the Breach’s core contract). 
A hover/target Forecast Card that shows the player-facing outcome: hit probability (if any), expected damage (or range), crit (if relevant), status effects, displacement endpoints, and counterattack/retaliation risk (XCOM 2 demonstrates how much trust this builds when it’s consistently available). 
A Terrain Read Overlay that makes height/obstruction legible when you need it (Triangle Strategy’s official materials repeatedly teach “use high ground,” implying the UI must keep elevation salient). 
A bounded Planning Undo (debug-level is fine for the spike) that allows reordering and correction until commitment, mirroring the “rewind until you end your turn” philosophy that Tactical Breach Wizards explicitly frames as core to experimentation. 
Ideal version that preserves the thesis without drifting into cockpit UI:

Default view remains clean, while overlays are layered and discoverable: e.g., tap for threat, hold for intent, aim for forecast, and a separate terrain toggle—so density is opt-in and contextual, matching XCOM’s approach of tying extra data to selection/aim states rather than always-on clutter. 
“Truth escalation” is consistent: board overlay shows spatial truth; forecast card shows numeric truth; timeline (if applicable) shows temporal truth. Nintendo’s Triangle Strategy guidance treats turn order as strategic and even quantifies turn-skip tempo effects, supporting the value of a visible timeline when initiative matters. 
Drift risks to actively avoid (because the references warn against them):

Copying HUD density without a stable contract. Even as an admirer, Tom Francis describes XCOM 2 as having “clarity problems,” which is an important caution against assuming “more info” automatically means “clearer play.” 
Making rewinds a substitute for clarity. Tactical Breach Wizards still invests in legibility improvements (e.g., large UI mode), implying that experimentation tools amplify good UI—they don’t replace it. 
Over-promising threat certainty when combat contains conditional reactions. Fire Emblem-style danger areas work best when threat is mostly determined by movement + range, so if The Fractured Road includes interrupts, stealth, overwatch-like states, or conditional aggro, your threat layer needs clear conditional cues rather than pretending those systems don’t exist. 
In short: the research supports your proposed center of gravity. The highest-integrity, fastest-to-prove hybrid for The Fractured Road is Into the Breach–level board truth, Fire Emblem–level threat toggles, Triangle Strategy–level terrain salience, XCOM-level forecast feedback, and a Tactical Breach Wizards–style bounded undo during the language-forming phase—implemented as a coherent contract, not a collage. 
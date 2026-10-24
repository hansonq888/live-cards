// Every fan-facing string in five languages. Lines built from engine facts (stats lines,
// director reasons, build-up captions) are rendered here from those facts, so a translation
// can never change a number. AI lines are localized server-side and re-verified there.
export type Lang = "en" | "es" | "fr" | "pt" | "ar";
type Dict = Record<string, string>;
type Args = Record<string, string | number | boolean | null | undefined>;

const UI: Record<Lang, Dict> = {
  en: {
    auto: "AUTO-DIRECTOR", predicted: "AUTO-DIRECTOR · PREDICTED", your_pick: "YOUR PICK", replay: "BUILD-UP REPLAY",
    goal: "GOAL", verified: "✓ verified", explaining: "Explaining and verifying…", ai_checking: "AI line being checked",
    lang_checking: "{L} version being checked", km: "km", top: "top km/h", passes: "passes", shots: "shots",
    pace: "Pace", passing: "Passing", threat: "Threat", defending: "Defending", engine: "Engine",
    form_0: "Struggling", form_1: "Quiet", form_2: "Steady", form_3: "Playing well", form_4: "On fire", checked: "✓ checked", numbers: "Numbers", hide_numbers: "Hide numbers", analyse: "Analyse", view: "View", rating: "Rating", rings: "Stat rings", rings_off: "Stat rings: off", rings_hint: "hover a player for the number",
    card_intro: "Card starts at 6.0. Every change explains itself.", how_built: "HOW THE GOAL WAS BUILT",
    explain_goal: "Explain the goal", revisit: "REVISIT", back_live: "Back to live", studio: "Studio view",
    ask: "Ask", ask_ph: "Ask about any player or the match…", checking: "Checking the match data…",
    refused: "refused to guess", ask_intro: "Answers come only from the match data, checked by the Verifier and the Reviewer. If it can't be proven, it says so.",
    fastest: "FASTEST", in_a_row: "IN A ROW", synthetic: "Synthetic match · fictional clubs",
    key_hint: "Key moments: click one to replay it as it happened", key_empty: "Key moments appear here as they happen (first ones around 23′ and 30′)",
    stats: "stats", ai: "AI", evidence: "evidence",
    q1: "Why did Varenne's rating jump?", q2: "Who has been the fastest player?", q3: "How is Hearne doing?", q4: "Who controls the game right now?", q5: "Who has run the most?",
  },
  es: {
    auto: "DIRECTOR AUTOMÁTICO", predicted: "DIRECTOR · ANTICIPACIÓN", your_pick: "TU ELECCIÓN", replay: "REPETICIÓN DE LA JUGADA",
    goal: "GOL", verified: "✓ verificado", explaining: "Explicando y verificando…", ai_checking: "Verificando la línea de IA",
    lang_checking: "Verificando la versión {L}", km: "km", top: "vel. máx. km/h", passes: "pases", shots: "tiros",
    pace: "Ritmo", passing: "Pase", threat: "Peligro", defending: "Defensa", engine: "Motor",
    form_0: "En apuros", form_1: "Discreto", form_2: "Cumplidor", form_3: "A buen nivel", form_4: "Encendido", checked: "✓ verificado", numbers: "Números", hide_numbers: "Ocultar números", analyse: "Analizar", view: "Vista", rating: "Nota", rings: "Anillos", rings_off: "Anillos: no", rings_hint: "pasa el ratón sobre un jugador",
    card_intro: "La carta empieza en 6.0. Cada cambio se explica solo.", how_built: "ASÍ SE CONSTRUYÓ EL GOL",
    explain_goal: "Explica el gol", revisit: "REPETICIÓN", back_live: "Volver al directo", studio: "Vista estudio",
    ask: "Pregunta", ask_ph: "Pregunta sobre cualquier jugador o el partido…", checking: "Consultando los datos del partido…",
    refused: "no adivina", ask_intro: "Las respuestas salen solo de los datos del partido, revisadas por el Verificador y el Revisor. Si no se puede demostrar, lo dice.",
    fastest: "EL MÁS RÁPIDO", in_a_row: "SEGUIDAS", synthetic: "Partido sintético · clubes ficticios",
    key_hint: "Momentos clave: pulsa uno para verlo de nuevo", key_empty: "Los momentos clave aparecen aquí (los primeros hacia el 23′ y el 30′)",
    stats: "datos", ai: "IA", evidence: "pruebas",
    q1: "¿Por qué subió la nota de Varenne?", q2: "¿Quién ha sido el jugador más rápido?", q3: "¿Cómo está jugando Hearne?", q4: "¿Quién controla el partido ahora?", q5: "¿Quién ha corrido más?",
  },
  fr: {
    auto: "RÉALISATION AUTO", predicted: "RÉALISATION · ANTICIPATION", your_pick: "VOTRE CHOIX", replay: "REVOIR L'ACTION",
    goal: "BUT", verified: "✓ vérifié", explaining: "Explication et vérification…", ai_checking: "Ligne IA en vérification",
    lang_checking: "Version {L} en vérification", km: "km", top: "vitesse max km/h", passes: "passes", shots: "tirs",
    pace: "Vitesse", passing: "Passe", threat: "Menace", defending: "Défense", engine: "Moteur",
    form_0: "En difficulté", form_1: "Discret", form_2: "Solide", form_3: "En forme", form_4: "Inarrêtable", checked: "✓ vérifié", numbers: "Chiffres", hide_numbers: "Masquer les chiffres", analyse: "Analyser", view: "Affichage", rating: "Note", rings: "Anneaux", rings_off: "Anneaux : non", rings_hint: "survolez un joueur pour la valeur",
    card_intro: "La carte démarre à 6.0. Chaque changement s'explique.", how_built: "LA CONSTRUCTION DU BUT",
    explain_goal: "Expliquer le but", revisit: "REVOIR", back_live: "Retour au direct", studio: "Vue studio",
    ask: "Question", ask_ph: "Posez une question sur un joueur ou le match…", checking: "Vérification des données du match…",
    refused: "refuse de deviner", ask_intro: "Les réponses viennent uniquement des données du match, contrôlées par le Vérificateur et le Relecteur. Si ce n'est pas prouvable, il le dit.",
    fastest: "LE PLUS RAPIDE", in_a_row: "D'AFFILÉE", synthetic: "Match synthétique · clubs fictifs",
    key_hint: "Moments clés : cliquez pour revoir l'action", key_empty: "Les moments clés apparaissent ici (les premiers vers la 23′ et la 30′)",
    stats: "stats", ai: "IA", evidence: "preuves",
    q1: "Pourquoi la note de Varenne a-t-elle bondi ?", q2: "Qui a été le joueur le plus rapide ?", q3: "Comment joue Hearne ?", q4: "Qui contrôle le match en ce moment ?", q5: "Qui a le plus couru ?",
  },
  pt: {
    auto: "DIREÇÃO AUTOMÁTICA", predicted: "DIREÇÃO · ANTECIPAÇÃO", your_pick: "SUA ESCOLHA", replay: "REPLAY DA JOGADA",
    goal: "GOL", verified: "✓ verificado", explaining: "Explicando e verificando…", ai_checking: "Linha de IA em verificação",
    lang_checking: "Versão {L} em verificação", km: "km", top: "vel. máx. km/h", passes: "passes", shots: "chutes",
    pace: "Ritmo", passing: "Passe", threat: "Perigo", defending: "Defesa", engine: "Motor",
    form_0: "Em apuros", form_1: "Discreto", form_2: "Regular", form_3: "Jogando bem", form_4: "Em chamas", checked: "✓ verificado", numbers: "Números", hide_numbers: "Ocultar números", analyse: "Analisar", view: "Vista", rating: "Nota", rings: "Anéis", rings_off: "Anéis: não", rings_hint: "passe o rato sobre um jogador",
    card_intro: "A carta começa em 6.0. Cada mudança se explica.", how_built: "COMO O GOL FOI CONSTRUÍDO",
    explain_goal: "Explicar o gol", revisit: "REVER", back_live: "Voltar ao vivo", studio: "Vista estúdio",
    ask: "Pergunte", ask_ph: "Pergunte sobre qualquer jogador ou a partida…", checking: "Consultando os dados da partida…",
    refused: "não chuta", ask_intro: "As respostas vêm só dos dados da partida, conferidas pelo Verificador e pelo Revisor. Se não dá para provar, ele avisa.",
    fastest: "O MAIS RÁPIDO", in_a_row: "SEGUIDAS", synthetic: "Partida sintética · clubes fictícios",
    key_hint: "Momentos-chave: clique para rever o lance", key_empty: "Os momentos-chave aparecem aqui (os primeiros por volta dos 23′ e 30′)",
    stats: "dados", ai: "IA", evidence: "provas",
    q1: "Por que a nota de Varenne subiu?", q2: "Quem foi o jogador mais rápido?", q3: "Como está jogando Hearne?", q4: "Quem controla o jogo agora?", q5: "Quem correu mais?",
  },
  ar: {
    auto: "المخرج الآلي", predicted: "المخرج الآلي · توقّع", your_pick: "اختيارك", replay: "إعادة بناء الهجمة",
    goal: "هدف", verified: "✓ تم التحقق", explaining: "جارٍ الشرح والتحقق…", ai_checking: "يجري التحقق من نص الذكاء الاصطناعي",
    lang_checking: "يجري التحقق من النسخة {L}", km: "كم", top: "السرعة القصوى كم/س", passes: "تمريرات", shots: "تسديدات",
    pace: "السرعة", passing: "التمرير", threat: "الخطورة", defending: "الدفاع", engine: "المجهود",
    form_0: "في معاناة", form_1: "هادئ", form_2: "ثابت", form_3: "في مستوى جيد", form_4: "متألق", checked: "✓ تم التحقق", numbers: "الأرقام", hide_numbers: "إخفاء الأرقام", analyse: "تحليل", view: "العرض", rating: "التقييم", rings: "حلقات الإحصاء", rings_off: "الحلقات: إيقاف", rings_hint: "مرّر المؤشر فوق لاعب لرؤية الرقم",
    card_intro: "تبدأ البطاقة عند 6.0. كل تغيير يشرح نفسه.", how_built: "كيف صُنع الهدف",
    explain_goal: "اشرح الهدف", revisit: "إعادة", back_live: "العودة إلى البث", studio: "عرض الاستوديو",
    ask: "اسأل", ask_ph: "اسأل عن أي لاعب أو عن المباراة…", checking: "جارٍ التحقق من بيانات المباراة…",
    refused: "لا يخمّن", ask_intro: "الإجابات من بيانات المباراة فقط، ويتحقق منها المدقق والمراجع. إن تعذّر الإثبات يقول ذلك.",
    fastest: "الأسرع", in_a_row: "متتالية", synthetic: "مباراة اصطناعية · أندية خيالية",
    key_hint: "اللحظات الحاسمة: اضغط لإعادة اللقطة", key_empty: "تظهر اللحظات الحاسمة هنا (أولها قرابة الدقيقة 23′ و30′)",
    stats: "إحصاءات", ai: "ذكاء اصطناعي", evidence: "أدلة",
    q1: "لماذا ارتفع تقييم Varenne؟", q2: "من كان أسرع لاعب؟", q3: "كيف يلعب Hearne؟", q4: "من يسيطر على المباراة الآن؟", q5: "من ركض أكثر؟",
  },
};

// Director reasons (keyed by the engine), build-up captions and stats lines: templates over facts.
const TPL: Record<Lang, Dict> = {
  en: {
    sp_ahead: "{team} control {m} m² of the final third", sp_gain: "{sign}{m} m² since the last touch", sp_toggle: "Space",
    bd_title: "Play breakdown", bd_goal: "Goal", bd_chance: "Chance", bd_step: "Touch {i} of {n}", diff: "Difficulty {d}/10", diff_0: "a routine pass", diff_1: "harder than most passes", diff_2: "a very hard pass", gain: "{m} m closer to goal", press: "Under pressure", xg: "xG {xg}", xg_n: "chances like this go in about {n} in 10", xg_0: "fewer than 1 in 10 chances like this go in", sprint_m: "sprint speed starts at 25 km/h", shot_kmh: "struck at {kmh} km/h", out_saved: "Saved", out_off_target: "Off target", out_blocked: "Blocked", bd_open: "Break it down",
    cross_incoming: "Cross incoming: {name} arriving, xG {xg} from there", box_incoming: "Ball into the box: {name} arriving, xG {xg} from there",
    long_ball: "Long ball toward {name}", scores: "{name} scores", fastest_sprint: "{name} at {kmh} km/h, fastest sprint of the match",
    sprint: "{name} sprinting at {kmh} km/h", big_chance: "Big chance for {name}", rating_upgrade: "{name}'s card upgrades to {to}",
    streak: "{name}: {count} successful actions in a row", breaking: "{name} breaking forward at {kmh} km/h",
    on_ball: "{name} on the ball", nearest_ball: "{name} nearest the ball", your_pick: "Following {name} (your pick)",
    win: "{name} wins it{from} {zone}", win_from: " from {from}", pass: "{from} → {to}: {m} m {kind}{speed}", speed: " at {kmh} km/h",
    sprint_step: "{name} sprints at {kmh} km/h{fastest}", fastest_tag: " (fastest of the match)", shot: "{name} shoots from {m} m, xG {xg}",
    goal_step: "GOAL at {kmh} km/h", story: "{passes} passes in {seconds} s: won {zone}, finished from xG {xg}",
    deep_own: "deep in their own half", own: "in their own half", mid: "in midfield", final: "in the final third",
    k_ground: "pass", k_long: "long ball", k_cross: "cross", k_through: "through ball",
    m_goal: "GOAL {player}{dist}{assist}. {score}", m_dist: " ({m} m, {kmh} km/h)", m_assist: ", assisted by {name}",
    m_rating: "{player} {from} → {to}: {reason}", m_attr: "{attr} {delta}", m_sprint: "{player} {kmh} km/h{fastest}",
    m_fastest: " · fastest sprint of the match", m_streak: "{player}: {count} successful actions in a row",
    m_big: "Big chance for {player}: {m} m out, xG {xg}", m_card: "Yellow card: {player}", m_sub: "Substitution: {on} on for {off}",
    m_momentum: "Momentum swing: {team} take control", m_km: "{player} has covered {km} km",
  },
  es: {
    sp_ahead: "{team} controla {m} m² del último tercio", sp_gain: "{sign}{m} m² desde el toque anterior", sp_toggle: "Espacio",
    bd_title: "Análisis de la jugada", bd_goal: "Gol", bd_chance: "Ocasión", bd_step: "Toque {i} de {n}", diff: "Dificultad {d}/10", diff_0: "un pase sencillo", diff_1: "más difícil que la mayoría", diff_2: "un pase muy difícil", gain: "{m} m más cerca de la portería", press: "Bajo presión", xg: "xG {xg}", xg_n: "ocasiones así acaban en gol unas {n} de cada 10", xg_0: "menos de 1 de cada 10 ocasiones así acaba en gol", sprint_m: "el sprint empieza en 25 km/h", shot_kmh: "disparo a {kmh} km/h", out_saved: "Parada", out_off_target: "Fuera", out_blocked: "Bloqueado", bd_open: "Analizar la jugada",
    cross_incoming: "Centro en camino: llega {name}, xG {xg} desde ahí", box_incoming: "Balón al área: llega {name}, xG {xg} desde ahí",
    long_ball: "Balón largo hacia {name}", scores: "¡Marca {name}!", fastest_sprint: "{name} a {kmh} km/h, el sprint más rápido del partido",
    sprint: "{name} esprinta a {kmh} km/h", big_chance: "Ocasión clara para {name}", rating_upgrade: "La carta de {name} sube a {to}",
    streak: "{name}: {count} acciones exitosas seguidas", breaking: "{name} rompe hacia adelante a {kmh} km/h",
    on_ball: "{name} con el balón", nearest_ball: "{name}, el más cercano al balón", your_pick: "Siguiendo a {name} (tu elección)",
    win: "{name} recupera el balón{from} {zone}", win_from: " ante {from}", pass: "{from} → {to}: {kind} de {m} m{speed}", speed: " a {kmh} km/h",
    sprint_step: "{name} esprinta a {kmh} km/h{fastest}", fastest_tag: " (el más rápido del partido)", shot: "{name} remata desde {m} m, xG {xg}",
    goal_step: "GOL a {kmh} km/h", story: "{passes} pases en {seconds} s: recuperado {zone}, finalizado con xG {xg}",
    deep_own: "muy atrás en su campo", own: "en su campo", mid: "en el centro del campo", final: "en el último tercio",
    k_ground: "pase", k_long: "balón largo", k_cross: "centro", k_through: "pase al hueco",
    m_goal: "GOL de {player}{dist}{assist}. {score}", m_dist: " ({m} m, {kmh} km/h)", m_assist: ", asistencia de {name}",
    m_rating: "{player} {from} → {to}: {reason}", m_attr: "{attr} {delta}", m_sprint: "{player} {kmh} km/h{fastest}",
    m_fastest: " · el sprint más rápido del partido", m_streak: "{player}: {count} acciones exitosas seguidas",
    m_big: "Ocasión clara para {player}: a {m} m, xG {xg}", m_card: "Tarjeta amarilla: {player}", m_sub: "Cambio: entra {on}, sale {off}",
    m_momentum: "Cambio de dinámica: {team} toma el control", m_km: "{player} ya ha recorrido {km} km",
  },
  fr: {
    sp_ahead: "{team} contrôle {m} m² du dernier tiers", sp_gain: "{sign}{m} m² depuis la touche précédente", sp_toggle: "Espace",
    bd_title: "Décryptage de l'action", bd_goal: "But", bd_chance: "Occasion", bd_step: "Touche {i} sur {n}", diff: "Difficulté {d}/10", diff_0: "une passe simple", diff_1: "plus dure que la plupart", diff_2: "une passe très difficile", gain: "{m} m gagnés vers le but", press: "Sous pression", xg: "xG {xg}", xg_n: "ce type d'occasion finit au fond environ {n} fois sur 10", xg_0: "moins d'une fois sur 10 au fond", sprint_m: "le sprint commence à 25 km/h", shot_kmh: "frappe à {kmh} km/h", out_saved: "Arrêté", out_off_target: "Non cadré", out_blocked: "Contré", bd_open: "Décrypter l'action",
    cross_incoming: "Centre en approche : {name} arrive, xG {xg} de là", box_incoming: "Ballon dans la surface : {name} arrive, xG {xg} de là",
    long_ball: "Ballon long vers {name}", scores: "{name} marque", fastest_sprint: "{name} à {kmh} km/h, sprint le plus rapide du match",
    sprint: "{name} sprinte à {kmh} km/h", big_chance: "Grosse occasion pour {name}", rating_upgrade: "La carte de {name} passe à {to}",
    streak: "{name} : {count} actions réussies d'affilée", breaking: "{name} s'échappe à {kmh} km/h",
    on_ball: "{name} au ballon", nearest_ball: "{name}, le plus proche du ballon", your_pick: "On suit {name} (votre choix)",
    win: "{name} récupère le ballon{from} {zone}", win_from: " face à {from}", pass: "{from} → {to} : {kind} de {m} m{speed}", speed: " à {kmh} km/h",
    sprint_step: "{name} sprinte à {kmh} km/h{fastest}", fastest_tag: " (le plus rapide du match)", shot: "{name} frappe à {m} m, xG {xg}",
    goal_step: "BUT à {kmh} km/h", story: "{passes} passes en {seconds} s : ballon récupéré {zone}, conclu avec un xG de {xg}",
    deep_own: "très bas dans son camp", own: "dans son camp", mid: "au milieu de terrain", final: "dans le dernier tiers",
    k_ground: "passe", k_long: "ballon long", k_cross: "centre", k_through: "passe en profondeur",
    m_goal: "BUT de {player}{dist}{assist}. {score}", m_dist: " ({m} m, {kmh} km/h)", m_assist: ", passe décisive de {name}",
    m_rating: "{player} {from} → {to} : {reason}", m_attr: "{attr} {delta}", m_sprint: "{player} {kmh} km/h{fastest}",
    m_fastest: " · sprint le plus rapide du match", m_streak: "{player} : {count} actions réussies d'affilée",
    m_big: "Grosse occasion pour {player} : à {m} m, xG {xg}", m_card: "Carton jaune : {player}", m_sub: "Changement : {on} remplace {off}",
    m_momentum: "Bascule du match : {team} prend le contrôle", m_km: "{player} a parcouru {km} km",
  },
  pt: {
    sp_ahead: "{team} controla {m} m² do terço final", sp_gain: "{sign}{m} m² desde o toque anterior", sp_toggle: "Espaço",
    bd_title: "Análise da jogada", bd_goal: "Gol", bd_chance: "Chance", bd_step: "Toque {i} de {n}", diff: "Dificuldade {d}/10", diff_0: "um passe simples", diff_1: "mais difícil que a maioria", diff_2: "um passe muito difícil", gain: "{m} m mais perto do gol", press: "Sob pressão", xg: "xG {xg}", xg_n: "chances assim viram gol cerca de {n} em 10 vezes", xg_0: "menos de 1 em 10 chances assim vira gol", sprint_m: "o sprint começa em 25 km/h", shot_kmh: "chute a {kmh} km/h", out_saved: "Defendido", out_off_target: "Para fora", out_blocked: "Bloqueado", bd_open: "Analisar a jogada",
    cross_incoming: "Cruzamento a caminho: {name} chegando, xG {xg} dali", box_incoming: "Bola na área: {name} chegando, xG {xg} dali",
    long_ball: "Bola longa para {name}", scores: "{name} marca!", fastest_sprint: "{name} a {kmh} km/h, o sprint mais rápido da partida",
    sprint: "{name} em sprint a {kmh} km/h", big_chance: "Grande chance para {name}", rating_upgrade: "A carta de {name} sobe para {to}",
    streak: "{name}: {count} ações certas seguidas", breaking: "{name} arranca a {kmh} km/h",
    on_ball: "{name} com a bola", nearest_ball: "{name}, o mais próximo da bola", your_pick: "Seguindo {name} (sua escolha)",
    win: "{name} recupera a bola{from} {zone}", win_from: " de {from}", pass: "{from} → {to}: {kind} de {m} m{speed}", speed: " a {kmh} km/h",
    sprint_step: "{name} em sprint a {kmh} km/h{fastest}", fastest_tag: " (o mais rápido da partida)", shot: "{name} finaliza de {m} m, xG {xg}",
    goal_step: "GOL a {kmh} km/h", story: "{passes} passes em {seconds} s: bola recuperada {zone}, finalizado com xG {xg}",
    deep_own: "lá atrás no próprio campo", own: "no próprio campo", mid: "no meio-campo", final: "no terço final",
    k_ground: "passe", k_long: "bola longa", k_cross: "cruzamento", k_through: "passe em profundidade",
    m_goal: "GOL de {player}{dist}{assist}. {score}", m_dist: " ({m} m, {kmh} km/h)", m_assist: ", assistência de {name}",
    m_rating: "{player} {from} → {to}: {reason}", m_attr: "{attr} {delta}", m_sprint: "{player} {kmh} km/h{fastest}",
    m_fastest: " · o sprint mais rápido da partida", m_streak: "{player}: {count} ações certas seguidas",
    m_big: "Grande chance para {player}: a {m} m, xG {xg}", m_card: "Cartão amarelo: {player}", m_sub: "Substituição: entra {on}, sai {off}",
    m_momentum: "Virada no jogo: {team} assume o controle", m_km: "{player} já percorreu {km} km",
  },
  ar: {
    sp_ahead: "{team} يسيطر على {m} م² من الثلث الأخير", sp_gain: "{sign}{m} م² منذ اللمسة السابقة", sp_toggle: "المساحة",
    bd_title: "تحليل اللعبة", bd_goal: "هدف", bd_chance: "فرصة", bd_step: "اللمسة {i} من {n}", diff: "الصعوبة {d}/10", diff_0: "تمريرة سهلة", diff_1: "أصعب من معظم التمريرات", diff_2: "تمريرة صعبة جدًا", gain: "اقترب {m} م من المرمى", press: "تحت الضغط", xg: "xG {xg}", xg_n: "مثل هذه الفرص تُسجَّل نحو {n} مرات من 10", xg_0: "أقل من مرة من كل 10 فرص مماثلة تُسجَّل", sprint_m: "يبدأ العدو السريع من 25 كم/س", shot_kmh: "تسديدة بسرعة {kmh} كم/س", out_saved: "تصدٍّ", out_off_target: "خارج المرمى", out_blocked: "مُبعدة", bd_open: "حلّل اللعبة",
    cross_incoming: "عرضية قادمة: {name} يصل، xG {xg} من هناك", box_incoming: "كرة داخل المنطقة: {name} يصل، xG {xg} من هناك",
    long_ball: "كرة طويلة نحو {name}", scores: "{name} يسجل", fastest_sprint: "{name} بسرعة {kmh} كم/س، أسرع انطلاقة في المباراة",
    sprint: "{name} ينطلق بسرعة {kmh} كم/س", big_chance: "فرصة كبيرة لـ {name}", rating_upgrade: "بطاقة {name} ترتفع إلى {to}",
    streak: "{name}: {count} إجراءات ناجحة متتالية", breaking: "{name} يندفع للأمام بسرعة {kmh} كم/س",
    on_ball: "{name} يستحوذ على الكرة", nearest_ball: "{name} الأقرب إلى الكرة", your_pick: "نتابع {name} (اختيارك)",
    win: "{name} يستعيد الكرة{from} {zone}", win_from: " من {from}", pass: "{kind} من {from} إلى {to} لمسافة {m} م{speed}", speed: " بسرعة {kmh} كم/س",
    sprint_step: "{name} ينطلق بسرعة {kmh} كم/س{fastest}", fastest_tag: " (الأسرع في المباراة)", shot: "{name} يسدد من {m} م، xG {xg}",
    goal_step: "هدف بسرعة {kmh} كم/س", story: "{passes} تمريرات في {seconds} ث: استعادة {zone}، وإنهاء بـ xG {xg}",
    deep_own: "في عمق ملعبه", own: "في ملعبه", mid: "في وسط الملعب", final: "في الثلث الأخير",
    k_ground: "تمريرة", k_long: "كرة طويلة", k_cross: "عرضية", k_through: "تمريرة بينية",
    m_goal: "هدف {player}{dist}{assist}. {score}", m_dist: " ({m} م، {kmh} كم/س)", m_assist: "، بصناعة {name}",
    m_rating: "{player} من {from} إلى {to}: {reason}", m_attr: "{attr} {delta}", m_sprint: "{player} {kmh} كم/س{fastest}",
    m_fastest: " · أسرع انطلاقة في المباراة", m_streak: "{player}: {count} إجراءات ناجحة متتالية",
    m_big: "فرصة كبيرة لـ {player}: من {m} م، xG {xg}", m_card: "بطاقة صفراء: {player}", m_sub: "تبديل: دخول {on} وخروج {off}",
    m_momentum: "تحوّل في المباراة: {team} يفرض سيطرته", m_km: "{player} قطع {km} كم",
  },
};

// The engine's English rating-reason labels, translated.
const REASONS: Record<string, Record<Lang, string>> = {
  "goal": { en: "goal", es: "gol", fr: "but", pt: "gol", ar: "هدف" },
  "assist": { en: "assist", es: "asistencia", fr: "passe décisive", pt: "assistência", ar: "صناعة هدف" },
  "chance created": { en: "chance created", es: "ocasión creada", fr: "occasion créée", pt: "chance criada", ar: "فرصة مصنوعة" },
  "shot on target": { en: "shot on target", es: "tiro a puerta", fr: "tir cadré", pt: "chute no alvo", ar: "تسديدة على المرمى" },
  "tackle won": { en: "tackle won", es: "entrada ganada", fr: "tacle réussi", pt: "desarme", ar: "افتكاك ناجح" },
  "interception": { en: "interception", es: "intercepción", fr: "interception", pt: "interceptação", ar: "اعتراض" },
  "pass completed under pressure": { en: "pass completed under pressure", es: "pase completado bajo presión", fr: "passe réussie sous pression", pt: "passe certo sob pressão", ar: "تمريرة ناجحة تحت الضغط" },
  "lost the ball in own half": { en: "lost the ball in own half", es: "pérdida en campo propio", fr: "perte de balle dans son camp", pt: "perda de bola no próprio campo", ar: "فقدان الكرة في ملعبه" },
  "foul conceded": { en: "foul conceded", es: "falta cometida", fr: "faute commise", pt: "falta cometida", ar: "خطأ مرتكب" },
  "yellow card": { en: "yellow card", es: "tarjeta amarilla", fr: "carton jaune", pt: "cartão amarelo", ar: "بطاقة صفراء" },
};

const fill = (s: string, a: Args = {}) => s.replace(/\{(\w+)\}/g, (_, k) => (a[k] === undefined || a[k] === null ? "" : String(a[k])));

export function t(lang: Lang, key: string, args?: Args): string {
  return fill(UI[lang]?.[key] ?? TPL[lang]?.[key] ?? UI.en[key] ?? TPL.en[key] ?? key, args);
}

export function tpl(lang: Lang, key: string, args?: Args): string {
  return fill(TPL[lang]?.[key] ?? TPL.en[key] ?? key, args);
}

export const isRtl = (lang: Lang) => lang === "ar";

/** Director reason in the viewer's language; falls back to the engine's English text. */
export function directorReason(lang: Lang, key: string | undefined, args: Args | undefined, english: string): string {
  if (lang === "en" || !key || key === "replay") return key === "replay" && args?.text ? String(args.text) : english;
  const a = { ...args, xg: typeof args?.xg === "number" ? (args.xg as number).toFixed(2) : args?.xg };
  return TPL[lang][key] ? tpl(lang, key, a) : english;
}

export interface StepLike { kind: string; text: string; args?: Args }

/** A build-up caption from its facts. */
export function stepCaption(lang: Lang, s: StepLike): string {
  const a = s.args;
  if (lang === "en" || !a) return s.text;
  switch (s.kind) {
    case "win": return tpl(lang, "win", { name: a.name, zone: tpl(lang, String(a.zone)), from: a.from ? tpl(lang, "win_from", { from: a.from }) : "" });
    case "pass": return tpl(lang, "pass", { from: a.from, to: a.to, m: a.m, kind: tpl(lang, `k_${a.kind}`), speed: a.kmh ? tpl(lang, "speed", { kmh: a.kmh }) : "" });
    case "sprint": return tpl(lang, "sprint_step", { name: a.name, kmh: Number(a.kmh).toFixed(1), fastest: a.fastest ? tpl(lang, "fastest_tag") : "" });
    case "shot": return tpl(lang, "shot", { name: a.name, m: a.m, xg: Number(a.xg).toFixed(2) });
    case "goal": return a.kmh ? tpl(lang, "goal_step", { kmh: a.kmh }) : t(lang, "goal");
    case "end": return tpl(lang, `out_${a.outcome}`);
    default: return s.text;
  }
}

export function storyLine(lang: Lang, args: Args | undefined, english: string): string {
  if (lang === "en" || !args) return english;
  return tpl(lang, "story", { ...args, zone: tpl(lang, String(args.zone)), xg: Number(args.xg).toFixed(2) });
}

/** The instant stats line for a moment, rendered from its facts. */
export function statsLine(lang: Lang, type: string, f: Args, player: string, english: string, home: string, away: string): string {
  if (lang === "en") return english;
  const L = (k: string, a: Args) => tpl(lang, k, a);
  switch (type) {
    case "goal": {
      const dist = f.speed_kmh ? L("m_dist", { m: Math.round(Number(f.distance_m)), kmh: Math.round(Number(f.speed_kmh)) }) : "";
      const assist = f.assist ? L("m_assist", { name: String(f.assist).split(" ").slice(-1)[0] }) : "";
      return L("m_goal", { player, dist, assist, score: `${home} ${f.score_home}-${f.score_away} ${away}` });
    }
    case "rating_upgrade": case "rating_downgrade": {
      const r = REASONS[String(f.top_reason)]?.[lang] ?? f.top_reason;
      return L("m_rating", { player, from: Number(f.from).toFixed(1), to: Number(f.to).toFixed(1), reason: r });
    }
    case "attr_upgrade": case "attr_downgrade": {
      const d = Number(f.delta);
      return L("m_attr", { attr: t(lang, String(f.attr)), delta: `${d >= 0 ? "+" : ""}${d}` });
    }
    case "fastest_sprint": case "sprint":
      return L("m_sprint", { player, kmh: Number(f.speed_kmh).toFixed(1), fastest: type === "fastest_sprint" ? L("m_fastest", {}) : "" });
    case "streak": return L("m_streak", { player, count: f.count });
    case "big_chance": return L("m_big", { player, m: Math.round(Number(f.distance_m)), xg: Number(f.xg).toFixed(2) });
    case "card": return L("m_card", { player });
    case "substitution": return L("m_sub", { on: f.on, off: f.off });
    case "distance_milestone": return L("m_km", { player, km: f.km });
    default: return english;
  }
}

/** What a step's numbers mean, in words. The numbers come from the engine; the meaning is a
 *  fixed rule here (difficulty bands, xG as "n in 10"), so nothing is guessed. */
export function stepMeaning(lang: Lang, s: StepLike): { label: string; meaning?: string }[] {
  const a = s.args ?? {};
  const out: { label: string; meaning?: string }[] = [];
  if (s.kind === "pass") {
    const d = Number(a.difficulty);
    if (!Number.isNaN(d)) out.push({ label: tpl(lang, "diff", { d: d.toFixed(1) }), meaning: tpl(lang, d >= 6.5 ? "diff_2" : d >= 4.5 ? "diff_1" : "diff_0") });
    if (Number(a.gain) > 0) out.push({ label: tpl(lang, "gain", { m: a.gain }) });
    if (a.pressure) out.push({ label: tpl(lang, "press") });
  } else if (s.kind === "shot") {
    const q = Number(a.xg), n = Math.round(q * 10);
    out.push({ label: tpl(lang, "xg", { xg: q.toFixed(2) }), meaning: n >= 1 ? tpl(lang, "xg_n", { n }) : tpl(lang, "xg_0") });
    if (a.kmh) out.push({ label: tpl(lang, "shot_kmh", { kmh: a.kmh }) });
    if (a.pressure) out.push({ label: tpl(lang, "press") });
  } else if (s.kind === "sprint") {
    out.push({ label: `${Number(a.kmh).toFixed(1)} km/h`, meaning: tpl(lang, "sprint_m") });
  }
  return out;
}

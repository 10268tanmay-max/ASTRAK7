// ============================================================
// Mission definitions - data driven, easy to extend
// ============================================================

export const MISSIONS = [
  {
    id: 'lunar-dawn',
    title: 'LUNAR DAWN',
    tagline: 'Moon - Routine Repair',
    world: 'MOON',
    chip: 'chip-moon',
    brief: 'Solar array 7 stopped reporting last night. Land near the outpost, restore power and leave the academy flag where every future cadet can see it. Keep an eye on your oxygen, cadet.',
    seed: 20261011,
    accent: '#8fd8ff',
    env: {
      sky: '#01030a',
      sunColor: 0xffffff,
      sunIntensity: 2.6,
      sunSize: 30,
      sunPos: [220, 130, -180],
      hemiSky: '#8fa8c8',
      hemiGround: '#3c4148',
      hemiIntensity: 0.5,
      groundA: '#aeb4ba',
      groundB: '#4e5358',
      rockColor: '#7d838a',
      gravity: 1.62,
      stars: 1.0,
      timeBudget: 660,
      bodies: [
        { kind: 'earth', pos: [-380, 190, -620], scale: 110 }
      ],
      craters: [
        { x: -60, z: 40, r: 26, depth: 5 },
        { x: 120, z: -90, r: 34, depth: 6 },
        { x: 40, z: 160, r: 22, depth: 4 },
        { x: -160, z: -120, r: 30, depth: 5.5 },
        { x: 200, z: 60, r: 24, depth: 4.5 }
      ]
    },
    objectives: [
      { id: 'panels', type: 'repair', target: 3, label: 'Repair the solar array' },
      { id: 'samples', type: 'collect', target: 3, label: 'Collect lunar samples' },
      { id: 'flag', type: 'plant', target: 1, label: 'Plant the academy flag', plantKind: 'flag' }
    ]
  },
  {
    id: 'red-horizon',
    title: 'RED HORIZON',
    tagline: 'Mars - Red Planet Survey',
    world: 'MARS',
    chip: 'chip-mars',
    brief: 'The survey rover went quiet in the Meridian plains. Deploy the science instruments, gather rock samples for the geology lab, and get that rover rolling again. Mars dust gets everywhere - even in the RGB strips.',
    seed: 99012211,
    accent: '#ffb48a',
    env: {
      sky: '#7a3520',
      sunColor: 0xffd9b0,
      sunIntensity: 2.0,
      sunSize: 24,
      sunPos: [190, 80, -140],
      hemiSky: '#e0a87a',
      hemiGround: '#4a2718',
      hemiIntensity: 0.55,
      groundA: '#c1683b',
      groundB: '#6e321d',
      rockColor: '#8a4a33',
      gravity: 3.71,
      stars: 0.35,
      timeBudget: 720,
      bodies: [
        { kind: 'rocky', pos: [-320, 160, -580], scale: 40 },
        { kind: 'rocky', pos: [-150, 240, -500], scale: 22 }
      ],
      craters: [
        { x: -80, z: 60, r: 24, depth: 4 },
        { x: 140, z: -70, r: 30, depth: 5 },
        { x: 60, z: 180, r: 20, depth: 3.5 },
        { x: -180, z: -100, r: 26, depth: 4.5 }
      ]
    },
    objectives: [
      { id: 'instruments', type: 'deploy', target: 2, label: 'Deploy science instruments' },
      { id: 'samples', type: 'collect', target: 3, label: 'Collect rock samples' },
      { id: 'rover', type: 'fix', target: 1, label: 'Restore the survey rover' }
    ]
  },
  {
    id: 'lunar-night',
    title: 'LUNAR NIGHT',
    tagline: 'Moon - Dark Side Signals',
    world: 'MOON',
    chip: 'chip-dark',
    brief: 'On the far side it is always night. The comm relay is dead and strange glowing crystals have been spotted. Repair the relay, collect crystal samples, and raise the RGB beacon so the academy can find this base again.',
    seed: 4422177,
    accent: '#c9b8ff',
    env: {
      sky: '#000205',
      sunColor: 0xaaccff,
      sunIntensity: 0.9,
      sunSize: 26,
      sunPos: [-200, 100, 160],
      hemiSky: '#3a4a7a',
      hemiGround: '#10131c',
      hemiIntensity: 0.7,
      groundA: '#3c4150',
      groundB: '#11131b',
      rockColor: '#2c3040',
      gravity: 1.62,
      stars: 1.6,
      timeBudget: 600,
      bodies: [
        { kind: 'earth', pos: [260, 220, 520], scale: 120 }
      ],
      craters: [
        { x: -50, z: -30, r: 28, depth: 5.5 },
        { x: 130, z: 90, r: 24, depth: 4.5 },
        { x: -170, z: 110, r: 32, depth: 6 },
        { x: 90, z: -160, r: 22, depth: 4 }
      ]
    },
    objectives: [
      { id: 'crystals', type: 'collect', target: 3, label: 'Collect glowing crystals', collectKind: 'crystal' },
      { id: 'relays', type: 'repair', target: 2, label: 'Repair the comm relay', repairKind: 'relay' },
      { id: 'beacon', type: 'plant', target: 1, label: 'Raise the RGB beacon', plantKind: 'beacon' }
    ]
  },
  {
    id: 'crater-rush',
    title: 'CRATER RUSH',
    tagline: 'Moon - Timed Challenge',
    world: 'MOON',
    chip: 'chip-rush',
    brief: 'A timed drill, cadet! Collect four samples, fix the broken panels and plant the flag before your oxygen runs out. Sprinting burns O2 faster - plan your route through the craters.',
    seed: 77123499,
    accent: '#ffe27a',
    env: {
      sky: '#02040a',
      sunColor: 0xffffff,
      sunIntensity: 2.3,
      sunSize: 30,
      sunPos: [180, 150, 140],
      hemiSky: '#7d97b8',
      hemiGround: '#33383f',
      hemiIntensity: 0.45,
      groundA: '#a4aab0',
      groundB: '#464b51',
      rockColor: '#757b82',
      gravity: 1.62,
      stars: 1.1,
      timeBudget: 420,
      bodies: [
        { kind: 'earth', pos: [300, 160, -500], scale: 105 }
      ],
      craters: [
        { x: -40, z: 80, r: 20, depth: 4 },
        { x: 110, z: -110, r: 26, depth: 5 },
        { x: -140, z: -60, r: 24, depth: 4.5 },
        { x: 160, z: 40, r: 18, depth: 3.5 }
      ]
    },
    objectives: [
      { id: 'samples', type: 'collect', target: 4, label: 'Collect lunar samples' },
      { id: 'panels', type: 'repair', target: 2, label: 'Repair the solar panels' },
      { id: 'flag', type: 'plant', target: 1, label: 'Plant the academy flag', plantKind: 'flag' }
    ]
  }
];

// Habitat missions: build and balance the core systems
MISSIONS.push(
  {
    id: 'base-camp-alpha',
    title: 'BASE CAMP ALPHA',
    tagline: 'Mars - Habitat Systems',
    world: 'MARS',
    chip: 'chip-mars',
    habitat: true,
    brief: 'Academy exam: bring a full habitat online. Choose a power source, activate life support, shield the crew from radiation and start the hydroponics bay. A dust storm is forecast at the five-minute mark - your power choice will matter.',
    seed: 50511224,
    accent: '#ffb48a',
    env: {
      sky: '#7a3520',
      sunColor: 0xffd9b0,
      sunIntensity: 2.0,
      sunSize: 24,
      sunPos: [190, 80, -140],
      hemiSky: '#e0a87a',
      hemiGround: '#4a2718',
      hemiIntensity: 0.55,
      groundA: '#c1683b',
      groundB: '#6e321d',
      rockColor: '#8a4a33',
      gravity: 3.71,
      stars: 0.35,
      timeBudget: 840,
      habitat: { stormAt: 300, stormDur: 90, stormName: 'DUST STORM', spikes: [180, 560] },
      bodies: [
        { kind: 'rocky', pos: [-320, 160, -580], scale: 40 },
        { kind: 'rocky', pos: [-150, 240, -500], scale: 22 }
      ],
      craters: [
        { x: -80, z: 60, r: 24, depth: 4 },
        { x: 140, z: -70, r: 30, depth: 5 },
        { x: 60, z: 180, r: 20, depth: 3.5 }
      ]
    },
    objectives: [
      { id: 'power', type: 'habitat', target: 1, label: 'Bring power online' },
      { id: 'eclss', type: 'habitat', target: 1, label: 'Activate life support (ECLSS)' },
      { id: 'shield', type: 'habitat', target: 1, label: 'Deploy radiation shielding' },
      { id: 'food', type: 'habitat', target: 1, label: 'Start the hydroponics bay' },
      { id: 'storm', type: 'habitat', target: 1, label: 'Survive the dust storm' }
    ]
  },
  {
    id: 'polar-base',
    title: 'POLAR BASE',
    tagline: 'Moon - Habitat Systems',
    world: 'MOON',
    chip: 'chip-dark',
    habitat: true,
    brief: 'Night falls at the polar outpost and solar arrays die. Set up the habitat systems and keep the crew alive through the lunar night. Water walls or regolith - choose your shielding wisely, cadet.',
    seed: 90934551,
    accent: '#c9b8ff',
    env: {
      sky: '#010309',
      sunColor: 0xaaccff,
      sunIntensity: 1.0,
      sunSize: 26,
      sunPos: [-180, 120, 150],
      hemiSky: '#3a4a7a',
      hemiGround: '#10131c',
      hemiIntensity: 0.65,
      groundA: '#43495a',
      groundB: '#14161f',
      rockColor: '#2c3040',
      gravity: 1.62,
      stars: 1.5,
      timeBudget: 780,
      habitat: { stormAt: 280, stormDur: 100, stormName: 'LUNAR NIGHT', spikes: [150, 500] },
      bodies: [
        { kind: 'earth', pos: [260, 220, 520], scale: 120 }
      ],
      craters: [
        { x: -50, z: -30, r: 28, depth: 5.5 },
        { x: 130, z: 90, r: 24, depth: 4.5 },
        { x: 90, z: -160, r: 22, depth: 4 }
      ]
    },
    objectives: [
      { id: 'power', type: 'habitat', target: 1, label: 'Bring power online' },
      { id: 'eclss', type: 'habitat', target: 1, label: 'Activate life support (ECLSS)' },
      { id: 'shield', type: 'habitat', target: 1, label: 'Deploy radiation shielding' },
      { id: 'food', type: 'habitat', target: 1, label: 'Start the hydroponics bay' },
      { id: 'storm', type: 'habitat', target: 1, label: 'Survive the lunar night' }
    ]
  },
  {
    id: 'mars-radiation-alert',
    title: 'RADIATION ALERT',
    tagline: 'Mars - Hazard Response',
    world: 'MARS',
    chip: 'chip-mars',
    habitat: true,
    brief: 'A high-energy radiation surge is heading toward the settlement. The crew can either shelter in place and conserve power, or burrow deep underground and ride out the spike in heavier protection.',
    seed: 91883242,
    accent: '#ffb48a',
    env: {
      sky: '#7a3520',
      sunColor: 0xffd9b0,
      sunIntensity: 1.9,
      sunSize: 24,
      sunPos: [190, 80, -140],
      hemiSky: '#e0a87a',
      hemiGround: '#4a2718',
      hemiIntensity: 0.55,
      groundA: '#c1683b',
      groundB: '#6e321d',
      rockColor: '#8a4a33',
      gravity: 3.71,
      stars: 0.3,
      timeBudget: 540,
      habitat: {
        stormAt: 200,
        stormDur: 120,
        stormName: 'RADIATION SURGE',
        spikes: [110, 220, 330, 440],
        waterStart: 52,
        foodStart: 58,
        crewStart: 90
      },
      bodies: [
        { kind: 'rocky', pos: [-320, 160, -580], scale: 40 },
        { kind: 'rocky', pos: [-150, 240, -500], scale: 22 }
      ],
      craters: [
        { x: -80, z: 60, r: 24, depth: 4 },
        { x: 140, z: -70, r: 30, depth: 5 },
        { x: 60, z: 180, r: 20, depth: 3.5 }
      ]
    },
    objectives: [
      { id: 'power', type: 'habitat', target: 1, label: 'Restore the habitat power circuit' },
      { id: 'eclss', type: 'habitat', target: 1, label: 'Seal the ECLSS loop' },
      { id: 'shield', type: 'habitat', target: 1, label: 'Choose a radiation response plan' },
      { id: 'food', type: 'habitat', target: 1, label: 'Activate emergency food recycling' },
      { id: 'storm', type: 'habitat', target: 1, label: 'Ride out the radiation surge' }
    ]
  },
  {
    id: 'mars-eclss-failure',
    title: 'ECLSS FAILURE',
    tagline: 'Mars - Life Support Emergency',
    world: 'MARS',
    chip: 'chip-mars',
    habitat: true,
    oxygenReserveHours: 48,
    brief: 'The ECLSS has failed and the habitat is running on its 48-hour oxygen reserve. Restore emergency power, repair the life-support loop, then return to the lander before the reserve runs out. Time is accelerated for this training simulation.',
    seed: 72188405,
    accent: '#ff927f',
    env: {
      sky: '#793a2a',
      sunColor: 0xffd9b0,
      sunIntensity: 1.9,
      sunSize: 24,
      sunPos: [190, 80, -140],
      hemiSky: '#e0a87a',
      hemiGround: '#4a2718',
      hemiIntensity: 0.55,
      groundA: '#c1683b',
      groundB: '#6e321d',
      rockColor: '#8a4a33',
      gravity: 3.71,
      stars: 0.3,
      timeBudget: 720,
      habitat: {
        waterStart: 68,
        foodStart: 52,
        crewStart: 94,
        eclssFailure: true
      },
      bodies: [
        { kind: 'rocky', pos: [-320, 160, -580], scale: 40 },
        { kind: 'rocky', pos: [-150, 240, -500], scale: 22 }
      ],
      craters: [
        { x: -80, z: 60, r: 24, depth: 4 },
        { x: 140, z: -70, r: 30, depth: 5 },
        { x: 60, z: 180, r: 20, depth: 3.5 }
      ]
    },
    objectives: [
      { id: 'power', type: 'habitat', target: 1, label: 'Restore emergency power' },
      { id: 'eclss', type: 'habitat', target: 1, label: 'Repair the failed ECLSS loop' }
    ]
  },
  {
    id: 'delayed-resupply',
    title: 'DELAYED RESUPPLY',
    tagline: 'Moon - Survival Window',
    world: 'LUNAR OUTPOST',
    chip: 'chip-dark',
    habitat: true,
    brief: 'The resupply pod was delayed by a solar storm. Your base is running on emergency stores: ration food and water, keep the habitat online, and hold out until the next cargo window opens.',
    seed: 81044122,
    accent: '#ffd27a',
    env: {
      sky: '#050b13',
      sunColor: 0xf5d9a6,
      sunIntensity: 1.2,
      sunSize: 26,
      sunPos: [180, 120, 90],
      hemiSky: '#96a9d4',
      hemiGround: '#1b2129',
      hemiIntensity: 0.6,
      groundA: '#8f9aa6',
      groundB: '#3b434d',
      rockColor: '#6d7782',
      gravity: 1.62,
      stars: 1.4,
      timeBudget: 540,
      habitat: {
        stormAt: 180,
        stormDur: 95,
        stormName: 'SOLAR FLARE',
        spikes: [110, 260, 420],
        waterStart: 28,
        foodStart: 22,
        crewStart: 88,
        survivalMode: true
      },
      bodies: [
        { kind: 'earth', pos: [260, 220, 520], scale: 120 }
      ],
      craters: [
        { x: -50, z: -30, r: 28, depth: 5.5 },
        { x: 130, z: 90, r: 24, depth: 4.5 },
        { x: -170, z: 110, r: 32, depth: 6 },
        { x: 90, z: -160, r: 22, depth: 4 }
      ]
    },
    objectives: [
      { id: 'power', type: 'habitat', target: 1, label: 'Restore emergency power' },
      { id: 'eclss', type: 'habitat', target: 1, label: 'Restart ECLSS recycling' },
      { id: 'shield', type: 'habitat', target: 1, label: 'Deploy emergency shielding' },
      { id: 'food', type: 'habitat', target: 1, label: 'Activate the emergency hydroponics bay' },
      { id: 'storm', type: 'habitat', target: 1, label: 'Survive the solar flare' }
    ]
  }
);

MISSIONS.push(
  {
    id: 'orbital-rescue',
    title: 'ORBITAL RESCUE',
    tagline: 'Earth Orbit - Satellite Repair',
    world: 'EARTH ORBIT',
    chip: 'chip-orbit',
    flight: true,
    brief: 'A solar storm damaged two communications satellites and scattered emergency supply pods near the station. Pilot your spacecraft to repair both satellites, recover the supplies, and return safely to the orbital station.',
    seed: 381904,
    accent: '#84e7ff',
    env: { gravity: 0, timeBudget: 900 },
    flightTargets: [
      { objectiveId: 'satellites', kind: 'satellite', positions: [[-150, 45, -210], [105, -35, -300]] },
      { objectiveId: 'supplies', kind: 'cargo', positions: [[180, 35, -110], [-70, -70, -390], [270, -20, -250]] }
    ],
    objectives: [
      { id: 'satellites', type: 'repair', target: 2, label: 'Repair damaged satellites' },
      { id: 'supplies', type: 'collect', target: 3, label: 'Recover emergency supply pods' }
    ]
  },
  {
    id: 'asteroid-patrol',
    title: 'ASTEROID PATROL',
    tagline: 'Deep Space - Survey & Rescue',
    world: 'DEEP SPACE',
    chip: 'chip-orbit',
    flight: true,
    brief: 'Survey the asteroid field and locate a stranded pilot. Fly between the rocks to scan three asteroids, retrieve the rescue capsule, then bring your ship back to the station.',
    seed: 882107,
    accent: '#ffc77a',
    env: { gravity: 0, timeBudget: 840 },
    flightTargets: [
      { objectiveId: 'scans', kind: 'asteroid', positions: [[-180, 40, -190], [110, -65, -330], [245, 80, -190]] },
      { objectiveId: 'capsule', kind: 'capsule', positions: [[-45, 105, -440]] }
    ],
    objectives: [
      { id: 'scans', type: 'scan', target: 3, label: 'Scan asteroids in the field' },
      { id: 'capsule', type: 'rescue', target: 1, label: 'Recover the stranded pilot' }
    ]
  },
  {
    id: 'lunar-relay-run',
    title: 'LUNAR RELAY RUN',
    tagline: 'Lunar Orbit - Communications',
    world: 'LUNAR ORBIT',
    chip: 'chip-orbit',
    flight: true,
    brief: 'A micrometeorite strike knocked out the lunar communications network. Pilot to three relay buoys and restore their signal, then deploy a replacement navigation beacon before returning to the orbital station.',
    seed: 671109,
    accent: '#c9b8ff',
    flightTheme: 'moon',
    env: { gravity: 0, timeBudget: 960 },
    flightTargets: [
      { objectiveId: 'relays', kind: 'relay', positions: [[-190, 75, -220], [110, -85, -300], [260, 35, -420]] },
      { objectiveId: 'beacon', kind: 'beacon', positions: [[-80, -45, -470]] }
    ],
    objectives: [
      { id: 'relays', type: 'repair', target: 3, label: 'Restore lunar relay buoys' },
      { id: 'beacon', type: 'deploy', target: 1, label: 'Deploy a navigation beacon' }
    ]
  },
  {
    id: 'comet-sample-run',
    title: 'COMET SAMPLE RUN',
    tagline: 'Deep Space - Comet Expedition',
    world: 'COMET 46P',
    chip: 'chip-orbit',
    flight: true,
    brief: 'Rendezvous with Comet 46P and collect three icy samples from its debris trail. Retrieve the returning science probe, then fly back to the station.',
    seed: 443812,
    accent: '#91f2dc',
    flightTheme: 'comet',
    env: { gravity: 0, timeBudget: 1020 },
    flightTargets: [
      { objectiveId: 'samples', kind: 'sample', positions: [[-180, 45, -210], [95, -45, -345], [250, 70, -260]] },
      { objectiveId: 'probe', kind: 'capsule', positions: [[-50, -100, -470]] }
    ],
    objectives: [
      { id: 'samples', type: 'collect', target: 3, label: 'Collect comet ice samples' },
      { id: 'probe', type: 'rescue', target: 1, label: 'Recover the science probe' }
    ]
  },
  {
    id: 'ice-vent-scout',
    title: 'ICE VENT SCOUT',
    tagline: 'Europa - Frozen Survey',
    world: 'EUROPA',
    chip: 'chip-moon',
    brief: 'A fracture field near the ice vents has split the path into three glacial lanes. Scan the ice shelf, recover the drill cores, and mark the safe route before the fissures close.',
    seed: 548221,
    accent: '#9fe7ff',
    env: {
      sky: '#040a12',
      sunColor: 0xbfe7ff,
      sunIntensity: 1.6,
      sunSize: 22,
      sunPos: [190, 90, -210],
      hemiSky: '#cfefff',
      hemiGround: '#203246',
      hemiIntensity: 0.5,
      groundA: '#b8ced9',
      groundB: '#60798b',
      rockColor: '#7e919e',
      gravity: 1.31,
      stars: 1.3,
      timeBudget: 720,
      bodies: [
        { kind: 'icy', pos: [-370, 180, -640], scale: 85 }
      ],
      craters: [
        { x: -90, z: 120, r: 26, depth: 5 },
        { x: 150, z: -80, r: 28, depth: 5.5 },
        { x: -190, z: -110, r: 30, depth: 6 },
        { x: 60, z: 180, r: 20, depth: 4 }
      ]
    },
    objectives: [
      { id: 'scan', type: 'deploy', target: 2, label: 'Deploy scan beacons' },
      { id: 'cores', type: 'collect', target: 3, label: 'Retrieve drill cores' },
      { id: 'route', type: 'plant', target: 1, label: 'Mark the safe route', plantKind: 'beacon' }
    ]
  },
);

MISSIONS.push(
  {
    id: 'team-mars-rover-recovery',
    title: 'ROVER RECOVERY CREW',
    tagline: 'Mars - Search & Recovery',
    world: 'MARS',
    chip: 'chip-mars',
    team: true,
    brief: 'A storm stranded a science rover far from the outpost. Split the work between navigation, sample collection, and field repairs, then deploy scan beacons to guide the rover home. Every role is playable solo.',
    seed: 64028113,
    accent: '#ffb48a',
    env: { ...MISSIONS.find((mission) => mission.id === 'red-horizon').env, timeBudget: 840 },
    objectives: [
      { id: 'rover', type: 'fix', target: 1, label: 'Repair the stranded science rover' },
      { id: 'samples', type: 'collect', target: 4, label: 'Recover the rover science samples' },
      { id: 'scans', type: 'deploy', target: 2, label: 'Deploy route scan beacons' }
    ]
  },
  {
    id: 'team-lunar-relay',
    title: 'LUNAR RELAY CREW',
    tagline: 'Moon - Communications Recovery',
    world: 'MOON',
    chip: 'chip-moon',
    team: true,
    brief: 'The lunar outpost has lost contact with mission control. Coordinate relay repairs, collect backup power crystals, and raise a beacon to reconnect the network. The whole operation can also be completed by one cadet.',
    seed: 30259147,
    accent: '#c9b8ff',
    env: { ...MISSIONS.find((mission) => mission.id === 'lunar-night').env, timeBudget: 780 },
    objectives: [
      { id: 'relays', type: 'repair', target: 3, label: 'Repair the communications relays', repairKind: 'relay' },
      { id: 'crystals', type: 'collect', target: 4, label: 'Collect backup power crystals', collectKind: 'crystal' },
      { id: 'beacon', type: 'plant', target: 1, label: 'Raise the long-range beacon', plantKind: 'beacon' }
    ]
  },
  {
    id: 'team-europa-rescue',
    title: 'GLACIER RESCUE TEAM',
    tagline: 'Europa - Ice Field Rescue',
    world: 'EUROPA',
    chip: 'chip-moon',
    team: true,
    brief: 'A research crew is cut off beyond Europa’s fracture field. Map a safe route with scan beacons, recover the drill cores, and mark the extraction point. Teammates can divide the survey, but solo cadets can do every task.',
    seed: 77312064,
    accent: '#9fe7ff',
    env: { ...MISSIONS.find((mission) => mission.id === 'ice-vent-scout').env, timeBudget: 840 },
    objectives: [
      { id: 'scan', type: 'deploy', target: 3, label: 'Map the fracture lanes' },
      { id: 'cores', type: 'collect', target: 4, label: 'Recover the research drill cores' },
      { id: 'route', type: 'plant', target: 1, label: 'Mark the crew extraction point', plantKind: 'beacon' }
    ]
  }
);

// Objective colors (hue) used for beacons + minimap
export const OBJECTIVE_HUES = {
  repair: 0.55,   // cyan
  collect: 0.12,  // amber
  plant: 0.35,    // green
  deploy: 0.78,   // violet
  fix: 0.07,      // orange
  scan: 0.78,
  rescue: 0.33,
  return: 0.0
};

export const INTERACT_LABELS = {
  repair: 'Repair',
  collect: 'Collect',
  plant: 'Plant',
  deploy: 'Deploy',
  fix: 'Restore',
  scan: 'Scan',
  rescue: 'Rescue',
  return: 'Board'
};

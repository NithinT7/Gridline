/* City-specific mayoral agendas: real issues each city faces, scheduled quarter by quarter (q0 = Q1 2027).
   Choice fields: cost (one-time, share of the city budget), fx [[shock, value, quarters]], g {group: approval push},
   risk [probability, fx, what happened], enact (policy key), lever {policy lever: change}.
   Shocks: rent/jobs/pop add to quarterly growth; *Mul multiply; revenue = share of budget collected per quarter. */
window.AGENDA={
nyc:[
 {q:1,t:"Rent Guidelines Board votes on stabilized leases",d:"About a million rent-stabilized apartments get their next lease increase. You appointed most of the board, and tenants expect a freeze; small landlords say costs are up 7%.",ch:[
   {l:"Push the board to freeze rents",fx:[["rent",-.0018,4]],g:{Renters:6,"Young adults":3,Homeowners:-3,Businesses:-2},risk:[.3,[["rent",.0006,4]],"Some owners pulled units off the market and deferred repairs; tenant complaints rose."]},
   {l:"Back a 1.5% / 3% compromise",fx:[["rent",-.0008,4]],g:{Renters:2}},
   {l:"Stay out of it (expected 3–4.5%)",fx:[],g:{Renters:-5,"Young adults":-2,Homeowners:1}}]},
 {q:2,t:"Fare-free buses: Albany wants a city match",d:"The MTA will run fare-free buses citywide if the city covers about $800M a year in lost fares.",ch:[
   {l:"Fund it",fx:[["revenue",-.0017,12],["transitMul",1.05,12],["congMul",.99,12]],g:{Renters:5,"Young adults":5,Seniors:2,Homeowners:-1},risk:[.25,[["transitMul",.98,4]],"Crowding slowed buses at first; ridership gains were smaller than hoped."]},
   {l:"Pilot on the five busiest routes",fx:[["revenue",-.0003,8],["transitMul",1.01,8]],g:{Renters:2,"Young adults":2}},
   {l:"Decline: too expensive",fx:[],g:{Renters:-3,"Young adults":-4}}]},
 {q:3,t:"Universal childcare: expand 3-K and 2-Care citywide",d:"The state paid for the first two years of free care for 2-year-olds. Making 3-K universal adds roughly $1.2B a year.",ch:[
   {l:"Go universal",fx:[["revenue",-.0026,12],["pop",.0004,12]],g:{Families:8,"Young adults":3,Businesses:1}},
   {l:"Expand in the 56 highest-need ZIP codes",fx:[["revenue",-.0009,12],["pop",.00015,12]],g:{Families:4}},
   {l:"Hold at current levels",fx:[],g:{Families:-4}}]},
 {q:4,t:"Rikers Island closure deadline arrives",d:"State law required Rikers to close by August 2027. The borough jails aren't finished and the population is still around 6,000.",ch:[
   {l:"Ask for an extension, speed up the borough jails",cost:.002,fx:[],g:{Homeowners:1,"Young adults":-2}},
   {l:"Push diversion and faster trials to shrink the population",cost:.001,fx:[["violentMul",1.01,4]],g:{"Young adults":3,Renters:2,Homeowners:-3},risk:[.3,[["violentMul",1.02,4],["approval",-2,2]],"A high-profile re-arrest of someone released early dominated the news."]},
   {l:"Accept a federal receiver for the jails",cost:0,fx:[["approval",-2,2]],g:{}}]},
 {q:5,t:"Rent Guidelines Board: second vote",d:"Another lease cycle. Owners point to rising insurance and fuel costs.",ch:[
   {l:"Freeze again",fx:[["rent",-.0015,4]],g:{Renters:4,Homeowners:-4,Businesses:-2},risk:[.4,[["rent",.0008,4],["g1",-3,3]],"A wave of small-building owners went into arrears; repairs stalled in older buildings."]},
   {l:"Modest increase tied to costs",fx:[],g:{Renters:-1,Homeowners:1}}]},
 {q:6,t:"Albany debates a millionaire's tax for the city",d:"A 2% surcharge on incomes over $1M could raise about $4B a year, but it needs the legislature and the governor.",ch:[
   {l:"Lobby hard for it",fx:[],g:{Renters:3,"Young adults":3,Businesses:-5},risk:[.55,[["approval",-2,2]],"It died in the Senate. You spent political capital and came away with nothing."]},
   {l:"Seek a smaller corporate tax instead",fx:[["revenue",.0015,12],["jobs",-.0003,8]],g:{Businesses:-4,Renters:1}},
   {l:"Drop it",fx:[],g:{"Young adults":-3,Businesses:2}}]},
 {q:7,t:"MTA asks the city to co-fund the Interborough Express",d:"The 14-mile light rail line from Bay Ridge to Jackson Heights needs a local share of about $1.5B.",ch:[
   {l:"Commit the city share",cost:.013,fx:[["transitMul",1.02,20]],g:{Renters:2,"Young adults":2,Businesses:2}},
   {l:"Pledge half, push the state for the rest",cost:.006,fx:[],g:{Businesses:1},risk:[.35,[["approval",-1,2]],"The state balked and the project slipped another year."]},
   {l:"Pass",fx:[],g:{"Young adults":-2}}]},
 {q:8,t:"City-owned grocery store pilot",d:"Five public grocery stores, one per borough, selling at cost in food deserts.",ch:[
   {l:"Open all five",cost:.0006,fx:[["revenue",-.0001,12]],g:{Renters:4,Families:3,Businesses:-3},risk:[.4,[["approval",-2,2]],"Two of the stores lost far more than projected and critics pounced."]},
   {l:"Open one in the Bronx first",cost:.00015,fx:[],g:{Renters:1}},
   {l:"Shelve it",fx:[],g:{Renters:-2}}]},
 {q:9,t:"Rent Guidelines Board: third vote",d:"The board meets again; your appointees await your signal.",ch:[
   {l:"Freeze",fx:[["rent",-.0015,4]],g:{Renters:4,Homeowners:-4}},
   {l:"Cost-based increase",fx:[],g:{Renters:-2,Homeowners:2}}]},
 {q:10,t:"Congestion toll set to rise from $9 to $12",d:"The MTA's scheduled step-up raises about $500M more a year for transit.",ch:[
   {l:"Support it",fx:[["congMul",.97,12],["transitMul",1.01,12]],g:{"Young adults":2,Homeowners:-3,Businesses:-1}},
   {l:"Ask the MTA to delay a year",fx:[],g:{Homeowners:2,"Young adults":-2},risk:[.3,[["transitMul",.99,8]],"The MTA cut planned service to cover the gap."]}]},
 {q:11,t:"Brooklyn-Queens Expressway cantilever is failing",d:"Engineers say the triple cantilever under Brooklyn Heights needs a full rebuild. Options trade years of traffic against cost.",ch:[
   {l:"Full rebuild with a park lid",cost:.012,fx:[["congMul",1.03,8]],g:{Families:3,Homeowners:2,Businesses:-1}},
   {l:"Shrink it to four lanes and repair",cost:.005,fx:[["congMul",1.02,12]],g:{"Young adults":2,Businesses:-2}},
   {l:"Patch it again",cost:.001,fx:[],g:{},risk:[.35,[["congMul",1.08,4],["approval",-4,2]],"A section had to close for emergency repairs, snarling traffic for weeks."]}]},
 {q:12,t:"Midtown South rezoning: next phase",d:"Planners want to allow about 9,500 more homes in the garment district and around Penn Station.",ch:[
   {l:"Approve with 25% affordable",fx:[["rent",-.0006,12],["jobs",.0002,8]],g:{"Young adults":3,Renters:2,Businesses:2,Homeowners:-2}},
   {l:"Approve a scaled-back version",fx:[["rent",-.0002,12]],g:{Homeowners:1}},
   {l:"Pause it",fx:[],g:{"Young adults":-2,Businesses:-2}}]},
 {q:13,t:"Rent Guidelines Board: election-year vote",d:"The last vote before you face voters.",ch:[
   {l:"Freeze",fx:[["rent",-.0015,4]],g:{Renters:5,Homeowners:-3}},
   {l:"Cost-based increase",fx:[],g:{Renters:-3,Homeowners:2}}]},
 {q:14,t:"Hurricane season: East Side Coastal Resiliency gaps",d:"The new floodwalls protect the Lower East Side, but Lower Manhattan's seaport is still exposed.",ch:[
   {l:"Fund deployable barriers for Lower Manhattan",cost:.003,fx:[],g:{Businesses:3,Homeowners:2}},
   {l:"Wait for federal Army Corps money",fx:[],g:{},risk:[.25,[["jobs",-.002,2],["approval",-4,3]],"A tropical storm pushed water into the Financial District's streets."]}]},
 {q:15,t:"State budget cuts city aid",d:"Albany trims $1.5B in school and Medicaid aid to the city.",ch:[
   {l:"Backfill from reserves",cost:.013,fx:[],g:{Families:2}},
   {l:"Pass the cuts through",fx:[["approval",-2,3]],g:{Families:-4,Seniors:-2}}]}
],
sea:[
 {q:1,t:"1,000 emergency housing units: how fast?",d:"Your executive order set a goal of 1,000 tiny houses and emergency units. Each village needs a site and a provider.",ch:[
   {l:"All 1,000 this year",cost:.006,fx:[["homelessMul",.95,8]],g:{Renters:3,Homeowners:2,Businesses:2},risk:[.35,[["approval",-2,2]],"Two neighborhoods sued over village siting and openings slipped."]},
   {l:"500 now, 500 next year",cost:.003,fx:[["homelessMul",.975,8]],g:{Homeowners:1}},
   {l:"Hold for county funding",fx:[],g:{Businesses:-3,Homeowners:-2}}]},
 {q:2,t:"Seattle Police staffing at historic lows",d:"SPD has about 950 deployable officers, far below its 1,400 target. Response times to priority calls are slow.",ch:[
   {l:"Hiring bonuses and a bigger academy class",cost:.002,fx:[],lever:{police:.05},g:{Homeowners:4,Businesses:4,Seniors:2,"Young adults":-2}},
   {l:"Expand CARE crisis responders instead",cost:.001,fx:[],lever:{crisis:1},g:{"Young adults":3,Renters:2,Homeowners:-1}},
   {l:"Hold the line",fx:[],g:{Homeowners:-3,Businesses:-3}}]},
 {q:3,t:"Social Housing Developer asks for its first sites",d:"The voter-approved developer is collecting its payroll tax and wants surplus city land for its first buildings.",ch:[
   {l:"Transfer five city parcels",cost:.001,fx:[["rent",-.0004,12]],g:{Renters:4,"Young adults":3,Businesses:-1}},
   {l:"Transfer one pilot site",fx:[["rent",-.0001,12]],g:{Renters:1}},
   {l:"Keep the land for sale",cost:-.003,fx:[],g:{Renters:-3}}]},
 {q:4,t:"Budget hole: JumpStart tax revenue falls short",d:"Big-employer payroll tax collections came in about $90M under forecast as tech hiring slowed.",ch:[
   {l:"Raise the JumpStart rate",fx:[["revenue",.0025,12],["jobs",-.0004,8]],g:{Businesses:-6,Renters:2}},
   {l:"Cut department budgets 3%",fx:[["approval",-1,2]],g:{Renters:-2,Families:-2}},
   {l:"Draw down the rainy-day fund",cost:.01,fx:[],g:{}}]},
 {q:5,t:"Sound Transit: Ballard Link station at Chinatown-ID",d:"Sound Transit asks the city to back a station option. The 4th Avenue shallow option is cheaper; the community wants to avoid years of construction on Jackson Street.",ch:[
   {l:"Back the community-preferred option",cost:.002,fx:[],g:{Renters:2,Businesses:-1}},
   {l:"Back the cheaper, faster option",fx:[],g:{Businesses:2,Renters:-2},risk:[.3,[["approval",-2,2]],"Chinatown-ID businesses sued; the decision became a citywide controversy."]}]},
 {q:6,t:"RVs lining SoDo and Ballard industrial streets",d:"Hundreds of people live in RVs along industrial streets. Businesses report break-ins; advocates warn against towing people's homes.",ch:[
   {l:"Safe lots with services, then enforce",cost:.0015,fx:[["homelessMul",.99,4]],g:{Businesses:3,Renters:1}},
   {l:"Tow and enforce parking limits",cost:.0003,fx:[["propertyMul",.985,4]],g:{Businesses:4,Homeowners:2,Renters:-3},risk:[.4,[["homelessMul",1.01,4]],"Most RV residents moved a few blocks away; complaints shifted neighborhoods."]},
   {l:"Leave it to the county",fx:[],g:{Businesses:-4}}]},
 {q:7,t:"One Seattle Plan: neighborhood centers",d:"The comprehensive plan update can allow apartments near transit and corner stores in single-family areas.",ch:[
   {l:"Go big: apartments near every frequent bus line",fx:[],enact:"adu",g:{"Young adults":4,Renters:2,Homeowners:-4}},
   {l:"Modest version: 30 neighborhood centers",fx:[["rent",-.0002,12]],g:{"Young adults":1,Homeowners:-1}},
   {l:"Minimum state requirements only",fx:[],g:{"Young adults":-3}}]},
 {q:8,t:"Shootings in the Rainier Valley",d:"A cluster of shootings near Rainier Beach leaves the community demanding action.",ch:[
   {l:"90-day plan: police presence plus violence interrupters",cost:.001,fx:[["violentMul",.98,4]],g:{Families:3,Homeowners:2}},
   {l:"Fund the Regional Peacekeepers Collective",cost:.0008,fx:[["violentMul",.985,6]],lever:{vio:1},g:{"Young adults":2,Renters:2},risk:[.3,[["violentMul",1.02,2]],"Another shooting happened before outreach workers were in place."]},
   {l:"Surveillance cameras on the corridor",cost:.0005,fx:[["violentMul",.99,4]],g:{Homeowners:2,"Young adults":-3}}]},
 {q:9,t:"Downtown offices still a third empty",d:"Office vacancy is around 30%. Owners want help converting buildings to housing.",ch:[
   {l:"Tax abatements for conversions",fx:[["revenue",-.0006,12],["pop",.0002,12]],g:{Businesses:4,"Young adults":2}},
   {l:"Fund downtown activation and safety",cost:.0015,fx:[["propertyMul",.99,4]],g:{Businesses:3}},
   {l:"Let the market sort it out",fx:[],g:{Businesses:-2}}]},
 {q:10,t:"Federal immigration raids reach Seattle",d:"ICE agents stage in private parking lots for operations in South Seattle.",ch:[
   {l:"Fund legal defense; police document ICE activity",cost:.0004,fx:[],g:{Renters:3,"Young adults":4,Homeowners:-1},risk:[.35,[["revenue",-.0004,4]],"Washington threatened to cut federal grants to the city."]},
   {l:"Stay neutral, follow state law",fx:[],g:{"Young adults":-3,Renters:-2}}]},
 {q:11,t:"Magnolia Bridge is past its life",d:"The 1930 bridge needs replacement; options run from $200M to over $400M.",ch:[
   {l:"Full replacement",cost:.04,fx:[],g:{Homeowners:3,Businesses:2}},
   {l:"Seismic retrofit for now",cost:.012,fx:[],g:{Homeowners:1},risk:[.2,[["congMul",1.03,4],["approval",-3,2]],"Inspectors closed it for emergency work, cutting off Magnolia's main route."]}]},
 {q:12,t:"NBA expansion: the SuperSonics could return",d:"The league is weighing Seattle. Climate Pledge Arena is ready; the owners want city help with practice facilities and transit service.",ch:[
   {l:"Offer a transit and facilities package",cost:.004,fx:[["jobs",.0004,4],["revenue",.0003,12]],g:{Businesses:4,"Young adults":4,Renters:-1},risk:[.35,[["approval",-2,2]],"The league picked another city first; the package sits unused."]},
   {l:"Cheer them on, no public money",fx:[],g:{"Young adults":1}}]},
 {q:13,t:"Heat dome forecast",d:"Forecasters warn of a 2021-style heat dome. Few Seattle homes have air conditioning.",ch:[
   {l:"Cooling centers, free transit, outreach",cost:.0008,fx:[],g:{Seniors:4,Renters:2}},
   {l:"Advisories only",fx:[],g:{},risk:[.4,[["approval",-5,3]],"Heat deaths rose and the response was called inadequate."]}]},
 {q:14,t:"Housing levy renewal goes to voters",d:"The current levy runs out in 2030. A bigger levy would build far more affordable homes but raise property taxes.",ch:[
   {l:"Ask voters for $1.5B",fx:[["rent",-.0004,12]],g:{Renters:4,"Young adults":2,Homeowners:-4},risk:[.3,[["approval",-3,2]],"Voters rejected the levy; affordable housing pipelines stalled."]},
   {l:"Renew at the current size",fx:[],g:{Renters:1}}]},
 {q:15,t:"County homelessness authority is restructured",d:"The regional authority is being folded back into the county. The city must decide how much funding and control to keep.",ch:[
   {l:"Bring services back in-house at the city",cost:.003,fx:[["homelessMul",.99,6]],g:{Homeowners:2,Businesses:2},risk:[.3,[["homelessMul",1.01,4]],"The handoff caused gaps in shelter contracts for months."]},
   {l:"Stay in the regional system",fx:[],g:{}}]}
]};

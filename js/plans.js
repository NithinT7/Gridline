/* Real transit projects that each city has planned or studied (approximate station locations).
   cost: published estimate in $B where one is widely reported; otherwise the game prices it per km. */
window.TRANSIT_PLANS={
 sea:[
  {id:"ballard",title:"Ballard Link Extension",kind:"subway",color:"#7E57C2",src:"Sound Transit 3 (2016 vote). Second downtown tunnel; opening targeted for the late 2030s.",
   st:[[47.5983,-122.3275,"Int'l District/Chinatown"],[47.6065,-122.3320,"Midtown"],[47.6118,-122.3372,"Westlake"],[47.6185,-122.3385,"Denny"],[47.6235,-122.3420,"South Lake Union"],[47.6238,-122.3525,"Seattle Center"],[47.6295,-122.3700,"Smith Cove"],[47.6450,-122.3770,"Interbay"],[47.6680,-122.3760,"Ballard"]]},
  {id:"wsea",title:"West Seattle Link Extension",kind:"rail",color:"#7E57C2",src:"Sound Transit 3. Elevated line from SODO over the Duwamish; opening targeted for 2032.",
   st:[[47.5810,-122.3275,"SODO"],[47.5705,-122.3630,"Delridge"],[47.5630,-122.3760,"Avalon"],[47.5610,-122.3870,"Alaska Junction"]]},
  {id:"ccc",title:"Center City Connector streetcar",kind:"streetcar",color:"#C4112F",cost:.29,src:"SDOT. Links the South Lake Union and First Hill streetcars along 1st Ave; paused after cost overruns.",
   st:[[47.6116,-122.3378,"Westlake"],[47.6095,-122.3410,"Pike Place Market"],[47.6050,-122.3375,"1st & Marion"],[47.6010,-122.3343,"Pioneer Square"]]}],
 nyc:[
  {id:"sas3",title:"Second Avenue Subway Phase 3",kind:"subway",color:"#00ADD0",src:"MTA. Extends the Q/T trunk south under Second Ave from 63rd St to Houston St; unfunded.",
   st:[[40.7642,-73.9660,"Lexington Av–63 St"],[40.7578,-73.9678,"55 St"],[40.7505,-73.9718,"42 St"],[40.7445,-73.9765,"34 St"],[40.7375,-73.9815,"23 St"],[40.7315,-73.9858,"14 St"],[40.7240,-73.9905,"Houston St"]]},
  {id:"sas4",title:"Second Avenue Subway Phase 4",kind:"subway",color:"#00ADD0",src:"MTA. Houston St to Hanover Square in the Financial District; unfunded.",
   st:[[40.7240,-73.9905,"Houston St"],[40.7180,-73.9935,"Grand St"],[40.7140,-73.9985,"Chatham Sq"],[40.7075,-74.0030,"Seaport"],[40.7046,-74.0092,"Hanover Sq"]]},
  {id:"bqx",title:"Brooklyn–Queens Connector streetcar (BQX)",kind:"streetcar",color:"#00838F",cost:2.7,src:"NYC EDC study (2018). Waterfront streetcar; shelved.",
   st:[[40.7033,-73.9881,"DUMBO"],[40.6995,-73.9730,"Navy Yard"],[40.7105,-73.9650,"Williamsburg"],[40.7275,-73.9570,"Greenpoint"],[40.7470,-73.9450,"Long Island City"],[40.7600,-73.9370,"Queensbridge"]]}],
 chi:[
  {id:"clinton",title:"Clinton Street Subway",kind:"subway",color:"#C60C30",src:"CTA Central Area plan (2009 concept). Relieves the Loop and links the commuter-rail stations.",
   st:[[41.8674,-87.6270,"Roosevelt"],[41.8675,-87.6400,"Roosevelt/Clinton"],[41.8790,-87.6405,"Union Station"],[41.8830,-87.6405,"Ogilvie"],[41.8857,-87.6417,"Lake/Clinton"],[41.8912,-87.6475,"Grand/Halsted"]]},
  {id:"carroll",title:"Carroll Avenue Transitway to Navy Pier",kind:"brt",color:"#2e7d32",src:"Chicago DOT Central Area plan concept. Busway on the old rail right-of-way north of the river.",
   st:[[41.8790,-87.6405,"Union Station"],[41.8830,-87.6405,"Ogilvie"],[41.8885,-87.6355,"Merchandise Mart"],[41.8890,-87.6280,"State/Kinzie"],[41.8905,-87.6230,"Michigan Ave"],[41.8920,-87.6175,"Streeterville"],[41.8917,-87.6090,"Navy Pier"]]}],
 sf:[
  {id:"portal",title:"The Portal (Caltrain downtown extension)",kind:"subway",color:"#E31837",cost:8.25,src:"TJPA. Brings Caltrain and future high-speed rail into Salesforce Transit Center.",
   st:[[37.7765,-122.3945,"4th & King"],[37.7775,-122.3965,"4th & Townsend"],[37.7895,-122.3965,"Salesforce Transit Center"]]},
  {id:"centralx",title:"Central Subway to Fisherman's Wharf",kind:"subway",line:"T",src:"SFMTA study. Extends the T Third line north past Chinatown.",
   st:[[37.7946,-122.4078,"Chinatown–Rose Pak"],[37.8006,-122.4100,"North Beach"],[37.8065,-122.4155,"Fisherman's Wharf"]]},
  {id:"geary",title:"Geary Boulevard subway",kind:"subway",color:"#00838F",src:"ConnectSF long-range plan. Rail for the city's busiest bus corridor.",
   st:[[37.7860,-122.4060,"Union Square"],[37.7855,-122.4210,"Van Ness"],[37.7843,-122.4330,"Fillmore"],[37.7825,-122.4465,"Masonic"],[37.7815,-122.4590,"Arguello"],[37.7805,-122.4710,"Park Presidio"]]}],
 sd:[
  {id:"airport",title:"Airport Transit Connection",kind:"rail",color:"#0077C8",src:"SANDAG. Rail link from downtown to San Diego International Airport terminals; under study.",
   st:[[32.7175,-117.1695,"Santa Fe Depot"],[32.7300,-117.1845,"Middletown"],[32.7340,-117.1960,"Terminal 1"],[32.7330,-117.2050,"Terminal 2"]]}]
};

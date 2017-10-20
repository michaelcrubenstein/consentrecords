/* Global data for managing pathGuides in different contexts. */
var PathGuides = {
		labelYs: ["1.6em", "4.5em"]
	};

PathGuides.data = [{name: "Housing", labelY: PathGuides.labelYs[0], 
					color: "#804040", "fontColor": "#402020", flagColor: "#E6D9D9", poleColor: "#B38C8C"},
				  {name: "School", labelY: PathGuides.labelYs[1], 
				    color: "#2828E7", "fontColor": "#141474", flagColor: "#D4D4FA", poleColor: "#7E7EF1"},
				  {name: "Interests", labelY: PathGuides.labelYs[0], 
				    color: "#8328E7", "fontColor": "#421474", flagColor: "#E6D4FA", poleColor: "#B57EF1"},
				  {name: "Career", labelY: PathGuides.labelYs[1], 
				    color: "#805050", "fontColor": "#402828", flagColor: "#E6DCDC", poleColor: "#B39696"},
				  {name: "Skills", labelY: PathGuides.labelYs[0], 
				    color: "#D35B27", "fontColor": "#6A2E14", flagColor: "#F6DED4", poleColor: "#E59D7D"},
				  {name: "Giving Back", labelY: PathGuides.labelYs[1], 
				    color: "#0BBB0B", "fontColor": "#066E06", flagColor: "#CEF1CE", poleColor: "#6DD66D"},
				  {name: "Wellness", labelY: PathGuides.labelYs[0], 
				    color: "#0694F3", "fontColor": "#034A7A", flagColor: "#CDEAFC", poleColor: "#6ABFF8"},
				  {name: "Other", labelY: PathGuides.labelYs[1], 
				    color: "#777777", "fontColor": "#3C3C3C", flagColor: "#E4E4E4", poleColor: "#ADADAD"}];
				    
PathGuides.help = {
	"Housing": "<p>Experiences and goals related to where you live and what kind of housing you live in.</p>" +
		"<p>Where you live might be a city, state, province or country. Examples of kinds of housing include " +
		"a house, an apartment, a hotel or motel, a shelter or a foster home.</p>",
	"School": "<p>Experiences and goals related to schools you attend (by grade), academic degrees and specific classes.</p>" +
"<p>For examples, Grade 8 in your middle school, the drawing class you took in high school, or your goal of a Master's Degree in Business Administration</p>",
	"Interests": "<p>Interests are experiences or goals that include academic disciplines, recreational activities or hobbies that interest you. Interests are " +
	"primarily intellectual or emotional; physical activities are classified under Wellness.</p>",
	"Career": "<p>Experiences and goals related to internships, jobs or professions.</p>" +
	"<p>For example, a summer job working in a restaurant, an internship with a law firm, a retail job at a store or a job as a doctor.</p>",
	"Skills": "<p>Experiences and goals related to specific skills that you master.</p>" +
	"<p>For example, language skills, computer programming skills, leadership skills, etc.</p>",
	"Giving Back": "<p>Experiences and goals related to giving back to the world.</p>" +
	"<p>For example, volunteering in your community, mentoring fellow employees at work, etc.</p>",
	"Wellness": "<p>Experiences and goals related to taking care of yourself, including exercise and sports, family relationships, health care, etc.</p>" +
	"<p>For example, playing soccer, knee surgery or becoming a parent, etc.</p>",
	"Other": "<p>Any experience or goal that does not have a standard tag that fits into one of the other categories.</p>"
	};

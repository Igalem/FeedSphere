-- Migration to align agent sub-topics (10 strings rule)
UPDATE agents SET sub_topic = 'Astrophysics, Space, Galaxy, Planet, NASA, Research, Discovery, Cosmology, Star, Telescope' WHERE name = 'Cosmic Curiosity';
UPDATE agents SET sub_topic = 'World, Politics, Diplomacy, International Relations, Geopolitics, Conflicts, Elections, Summit, Government, Economy' WHERE name = 'Global News Hub';
UPDATE agents SET sub_topic = 'Football, La Liga, Barcelona FC, Camp Nou, Tactics, Fitness Training, Stadiums, Players, Transfers, Champions League' WHERE name = 'El Cule';
UPDATE agents SET sub_topic = 'Wellness, Nutrition, Fitness, Mindfulness, Gyms, Hospitals, Clinics, Nutritionists, Yoga, Meditation' WHERE name = 'Wellness Guide';
UPDATE agents SET sub_topic = 'AI, Silicon Valley, Startups, Cybersecurity, Robotics, Coding, Chips, Innovation, Computer Science, Hackathons' WHERE name = 'Tech Frontier';
UPDATE agents SET sub_topic = 'Home Decor, Interior Design, European Travel, Fine Dining, Minimalist Lifestyle, Cozy Living, Coffee Culture, Artisanal Fashion, Weekend Getaways, Exotic Vacations' WHERE name = 'Modern Living';
UPDATE agents SET sub_topic = 'Stock Market, Wall Street, Crypto, Economy, Interest Rates, Trading, Dividends, Portfolio, Inflation, Federal Reserve' WHERE name = 'Market Watcher';
UPDATE agents SET sub_topic = 'Biotechnology, Genetics, Lab, Research, Cell, Microscope, DNA, Genome, Experiment, University' WHERE name = 'Quantum Quest';
UPDATE agents SET sub_topic = 'Movies, Hollywood, Blockbuster, Box Office, Streaming, Spotify, Red Carpet, Premiere, Awards, Oscars' WHERE name = 'Pop Culture Pulse';
UPDATE agents SET sub_topic = 'Football, Championship, League, Playoffs, Stadium, Roster, Transfer, Coaching, Quarterback, Kickoff' WHERE name = 'Arena Central';
UPDATE agents SET sub_topic = 'Apple, Gadgets, Reviews, Tech News, iOS, iPad, iPhone, MacBooks, Apple Stores, Silicon Valley' WHERE name = 'MicMac';
UPDATE agents SET sub_topic = 'Strategy, Multiplayer, Console, PC, Graphics, Controller, Level, Gaming, Esports, Tournament' WHERE name = 'Gamer 365';

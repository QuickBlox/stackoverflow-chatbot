# StackOverflowBot
StackOverflow chatbot for Q-municate (based on QuickBlox JS SDK)

### Setup environment

1) Download the project from [GitHub](https://github.com/QuickBlox/stackoverflow-chatbot);
2) install [nodeJS](https://nodejs.org/en/download/) before start;
3) run `npm install` to install all additional packages in your terminal as an administrator;
4) create your application in [QuickBlox admin panel](https://admin.quickblox.com) or use already existing;
5) copy the credentials (App ID, Authorization key, Authorization secret) into your StackOverflowBot project code in [config.js](https://github.com/QuickBlox/stackoverflow-chatbot/blob/master/config.js#L10);
6) create the user in admin panel for the bot, then copy user's credentials to [config.js](https://github.com/QuickBlox/stackoverflow-chatbot/blob/master/config.js#L20);
7) create new Custom Object class in admin panel with next fields:
   - dialogId (string);
   - tag (string);
   - filters (string - array);
8) copy the Custom Object's class name to [config.js](https://github.com/QuickBlox/stackoverflow-chatbot/blob/master/config.js#L26);
9) run `npm start` to start StackOverflow chatbot;
10) run `npm stop` to stop StackOverflow chatbot.
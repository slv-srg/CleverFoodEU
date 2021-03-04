## amoCRM Data Analytics
### Regular unloading, processing and uploading of historical data into the analytical tool.

The program uses amoCRM API and receives through GET requests lists of:
- leads,
- customers,
- start and end dates of leads.


After unloading the program handles and filters collections, processes corner cases, and builds a list of dates on which food was produced and delivered to the customers through leads lifetime.
Creates data objects for setters and uploads data to the mixpanel.com for overviewing in charts.

**Attention!** Launch of program requires a set of secret tokens to the client's amoCRM database and they are excluded form this repo.
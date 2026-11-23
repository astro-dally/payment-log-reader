# Payment Log Reader

A small tool I made to read payment API logs (Excel or CSV) without staring at a spreadsheet.

It sorts the log lines by time, explains each one in plain English (who called whom, pull or push), collapses repeated polls, and shows a short summary of what happened to the order.

Everything runs in the browser. The file you open is not uploaded anywhere.

## How to use

Open the page, choose your `.xlsx` or `.csv` log file, pick the order sheet, and click any line to see what it means and the raw request and response.

## Run locally

Open `index.html` in a browser.

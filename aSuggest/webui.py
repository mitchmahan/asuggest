from flask import Flask, url_for, render_template, request, Response
from pytrie import StringTrie
import json

webui = Flask(__name__)
webui.debug = True

dictionary = [
              'interface',
              'inet',
              'address',
              'access-list',
              'family',
              'ethernet-switching'
              ]

word_trie = StringTrie()

for word in dictionary:
    word_trie[word] = [word]

@webui.route('/')
def main_page():
    jquery = url_for('static', filename='jquery-1.11.1.min.js')
    return render_template('main.html', jquery=jquery)

@webui.route('/api/')
def autocomplete_api():
    searchString = request.args.get('search', '')
    results = word_trie.keys(prefix=searchString)
    return Response(json.dumps(results),  mimetype='application/json')

if __name__ == '__main__':
    webui.run()


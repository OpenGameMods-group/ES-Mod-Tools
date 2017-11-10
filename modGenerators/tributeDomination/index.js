// TRIBUTE DOMINATION
// Can demand tribute from all planets, tribute pay increased

// Defense fleets will be based on / influenced by:
// - the faction that owns it ( so merchant ships in the area aren't used as defense )
// - fleets in the area ( type of ships that guard it )
// - tribute value ( how many ships guard it )

// Tribute reward will be based on / influenced by:
// - planet attributes ( i.e "paradise" planets will obviously have some dosh) min 0.1 max 5
// - number of links ( more links = more trade routes ) * 1
// - owner faction ( some factions will / can pay more or less ) static value min 2500 max 50000
// - mineables in the area ( small increase ) * 1
// - trade fleets in the area ( more trade ships must mean it's more profitable? ) * 2 each fleet

// Also, I think I'll lower the required combat rating because you can have a low combat rating and still be considered a serious threat. i.e a merchant captain who decided to sell his merchant ships and buy an army of war ship would be a serious threat to any planet.

// Required combat rating will be based on / influenced by:
// - government ( fixed value for each gov )
// - defense fleet ( multiplier for amount of defense ships )
// - will have a limit so ridiculous combat ratings won't be required.

const { wordOrQuoted, tradeFleet } = require('../../config/regex')
const { generateModifierFile } = require('../../util/generateModifierFile')
const { listAllPlanetAttributes, selectAllBlocksWith, selectFrom } = require('../../util/grabDataUtil')
const modifiers = require('./modifiers.json')

const planetsData = selectAllBlocksWith({ _type: 'planet' }, 'map/planets')
const systemsData = selectAllBlocksWith({ _type: 'system' }, 'map/systems')

// remove numbers & quotes
const sanitizeStr = str => str.replace(/ \d+/g, '').replace(/"/g, '').trim()

const createModifierFile = () => {
  generateModifierFile(
    [{ _path: '/globals/governments', grab: '_value' }],
    listAllPlanetAttributes(),
    '/tributeDomination',
    (dataToSanitize) => dataToSanitize.map(key => key.replace(/"/g, '').trim())
  )
}

const isOwnedFleet = (fleetStr, government) => {
  // all fleet names should be quoted and without the number to match properly
  const fleetName = '"' + sanitizeStr(fleetStr) + '"'
  const fleetObj = selectFrom('government', '/util/superFleets', { _value: fleetName })
    .replace(/"/g, '').trim()
  // grab the fleet and check the government value
  return government === fleetObj
}

const isTradeFleet = fleet => new RegExp(tradeFleet).test(fleet)

const modifyPlanets = (planets = planetsData) => {
  const modified = planets.map(planet => {
    const planetSystem = systemsData
    .find(system => {
      const planetValRe = planet._value.replace(/"?\\?/g, '')
      const re = new RegExp(String.raw`"_value":"\\?.?${planetValRe}\\?.?`, 'g')

      return system.object.some(object => object._value === planet._value) || re.test(JSON.stringify(system.object))
    })

    try {
      let { link = [], government = '', fleet = [] } = planetSystem
      let { attributes = '', shipyard = [], outfitter = [], _value = '', _type = '' } = planet
      let tributeVal = 1
      government = sanitizeStr(government)

      // make sure to use proper fleets
      if (Array.isArray(fleet) && fleet.some(f => /(Arach)|(Kimek)|(Saryd)/gi.test(f))) {
        // use heliarch
        government = '"Heliarch"'
      } else if (/(Arach)|(Kimek)|(Saryd)/gi.test(fleet)) {
        government = '"Heliarch'
      } else if (Array.isArray(fleet) && fleet.some(f => /Militia/gi.test(f))) {
        // use militia
        government = '"Militia"'
      } else if (/Militia/gi.test(fleet)) {
        government = '"Militia"'
      }

      // convert string to array
      attributes = attributes
      ? attributes.match(wordOrQuoted)
      : []

      // sum up value of attributes, default to 1 if none
      const attrModifier = attributes
        .map(attr => modifiers[attr])
        .filter(attrModifier => !Number.isNaN(+attrModifier))
        .reduce((a, b) => { return a + b }, 1)

      // if link exists and is more than one multiplier is half # of links
      // else 0.5
      const linkModifier = Array.isArray(link)
        ? (link.length || 1) * 0.5
        : 0.5

      const ownedFleets = (Array.isArray(fleet)
        ? fleet.filter(f => isOwnedFleet(f, government) && !isTradeFleet(f))
        : isOwnedFleet(fleet, government) && !isTradeFleet(fleet)
          ? [fleet]
          : []
      ).map(f => sanitizeStr(f))

      // merchant fleets in the area & populate warFleets
      const merchantFleets = Array.isArray(fleet)
        ? fleet.filter(f => isTradeFleet(f)).map(f => sanitizeStr(f))
        : isTradeFleet(fleet)
          ? [fleet]
          : []

      tributeVal += modifiers[government] || 0
      tributeVal = Math.floor(tributeVal * attrModifier * linkModifier * (merchantFleets.length / 2 || 0.8))

      // * attrModifier * linkModifier * 0.5
      const defenseFleet = ownedFleets.map(f => {
        const amount = Math.floor(
          tributeVal * 0.0003 + ownedFleets.length * 2 * attrModifier * linkModifier -
          (modifiers[government] * 0.0005) + 1
        )
        return `"${f}" ${amount}`
      })

      // console.log('--------------\n',
      //   tributeVal,
      //   modifiers[government], government,
      //   planet._value,
      //   attrModifier, attributes,
      //   linkModifer, link,
      //   ownedFleets,
      //   merchantFleets,
      //   fleet,
      //   '\n--------------'
      // )

      const updatedPlanet = {
        _type,
        _value,
        system: planetSystem._value,
        tribute: {
          '_value': tributeVal,
          'threshold': 1000,
          'fleet': defenseFleet
        }
      }

      // if (updatedPlanet.tribute._value > 100000)
      console.log(updatedPlanet)

      return updatedPlanet
    } catch (err) {
      const planetValRe = planet._value.replace(/"?\\?/g, '')
      const re = new RegExp(`"_value":.?${planetValRe}.?`, 'g')

      console.log(`failed for: ${planet._value}`, planetSystem)
      console.log(re)
      console.log(err)
    }
  })

  return modified
}

modifyPlanets()

module.exports = {
  createModifierFile,
  modifyPlanets
}

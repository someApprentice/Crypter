<?php
namespace Crypter\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

use Symfony\Component\HttpFoundation\Response;

use Crypter\Entity\User;
use Crypter\Entity\Conference;
use Crypter\Entity\ConferenceReference;
use Crypter\Entity\Participant;
use Crypter\Entity\Message;
use Crypter\Entity\MessageReference;

use Doctrine\ORM\EntityManagerInterface;

// ./api/bin/phpunit -c ./api/phpunit.xml.dist
class MessengerControllerTest extends WebTestCase
{
    protected static $em;

    protected $alice;
    protected $bob;
    protected $tester;


    public static function setUpBeforeClass(): void
    {
        self::bootKernel();

        self::$em = self::$container->get(EntityManagerInterface::class);
    }

    public function setUp(): void
    {
        self::$em->getConnection()->query('TRUNCATE "user" CASCADE');
        self::$em->getConnection()->query('TRUNCATE conference, conference_reference, participant, message, message_reference CASCADE');

        $client = static::createClient();

        // populate users
        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => 'alice@crypter.com',
                'name' => 'Alice',
                'password' => 'password',
                'public_key' => '-----BEGIN PGP PUBLIC KEY BLOCK ... ',
                'private_key' => '-----BEGIN PGP PRIVATE KEY BLOCK ... ',
                'revocation_certificate' => '-----BEGIN PGP PUBLIC KEY BLOCK ... '
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->alice = json_decode($client->getResponse()->getContent(), $assoc = true);

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => 'bob@crypter.com',
                'name' => 'Bob',
                'password' => 'password',
                'public_key' => '-----BEGIN PGP PUBLIC KEY BLOCK ... ',
                'private_key' => '-----BEGIN PGP PRIVATE KEY BLOCK ... ',
                'revocation_certificate' => '-----BEGIN PGP PUBLIC KEY BLOCK ... '
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->bob = json_decode($client->getResponse()->getContent(), $assoc = true);

        $client->request(
            $method = 'POST',
            $uri = '/api/auth/registrate',
            $parameters = [
                'email' => 'tester@crypter.com',
                'name' => 'Tester',
                'password' => 'password',
                'public_key' => '-----BEGIN PGP PUBLIC KEY BLOCK ... ',
                'private_key' => '-----BEGIN PGP PRIVATE KEY BLOCK ... ',
                'revocation_certificate' => '-----BEGIN PGP PUBLIC KEY BLOCK ... '
            ],
            $files = [],
            $server = [
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $this->tester = json_decode($client->getResponse()->getContent(), $assoc = true);


        $client = static::createClient();

        // populate conference Alice with Bob
        $client->request(
            $method = 'POST',
            $uri = "/api/messenger/message/{$this->bob['uuid']}",
            $parameters = [
                'text' => 'Hey, Bob'
            ],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->alice['jwt']}",
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $client->request(
            $method = 'POST',
            $uri = "/api/messenger/message/{$this->alice['uuid']}",
            $parameters = [
                'text' => 'Hey, Alice'
            ],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->bob['jwt']}",
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        // populate conference Bob with Tester
        $client->request(
            $method = 'POST',
            $uri = "/api/messenger/message/{$this->bob['uuid']}",
            $parameters = [
                'text' => 'Hey, Bob'
            ],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->tester['jwt']}",
                'CONTENT_TYPE' => 'application/json'
            ]
        );

        $client->request(
            $method = 'POST',
            $uri = "/api/messenger/message/{$this->tester['uuid']}",
            $parameters = [
                'text' => 'Hey, Tester'
            ],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->bob['jwt']}",
                'CONTENT_TYPE' => 'application/json'
            ]
        );
    }

    public function tearDown(): void
    {
        self::$em->getConnection()->query('TRUNCATE "user" CASCADE');
        self::$em->getConnection()->query('TRUNCATE conference, conference_reference, participant, message, message_reference CASCADE');
    }

    public function testGetConferences()
    {
        $client = static::createClient();

        $client->request(
            $method = 'GET',
            $uri = "/api/messenger/conferences",
            $parameters = [],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->bob['jwt']}",
            ]
        );

        $response = $client->getResponse();

        $conferences = json_decode($response->getContent(), $assoc = true);

        $this->assertTrue($response->isSuccessful());

        $this->assertEquals(count($conferences), 2);
    }

    public function testGetMessages()
    {
        $client = static::createClient();

        $client->request(
            $method = 'GET',
            $uri = "/api/messenger/messages",
            $parameters = [],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->bob['jwt']}",
            ]
        );

        $response = $client->getResponse();

        $this->assertTrue($response->isSuccessful());

        $messages = json_decode($response->getContent(), $assoc = true);

        $this->assertEquals(count($messages), 4);


        $client = static::createClient();

        $client->request(
            $method = 'GET',
            $uri = "/api/messenger/conferences",
            $parameters = [],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->bob['jwt']}",
            ]
        );

        $conferences = json_decode($client->getResponse()->getContent(), $assoc = true);

        $this->assertTrue($client->getResponse()->isSuccessful());

        foreach ($conferences as $conference) {
            $client = static::createClient();

            $client->request(
                $method = 'GET',
                $uri = "/api/messenger/messages/{$conference['uuid']}",
                $parameters = [],
                $files = [],
                $server = [
                    'HTTP_AUTHORIZATION' => "Bearer {$this->bob['jwt']}",
                ]
            );

            $response = $client->getResponse();

            $this->assertTrue($response->isSuccessful());

            $messages = json_decode($response->getContent(), $assoc = true);

            $this->assertEquals(count($messages), 2);
        }
    }

    public function testForbiddenceOnMessages()
    {
        $client = static::createClient();

        $client->request(
            $method = 'GET',
            $uri = "/api/messenger/conferences",
            $parameters = [],
            $files = [],
            $server = [
                'HTTP_AUTHORIZATION' => "Bearer {$this->alice['jwt']}",
            ]
        );

        $response = $client->getResponse();

        $conferences = json_decode($response->getContent(), $assoc = true);

        foreach ($conferences as $conference) {
            $client = static::createClient();

            $client->request(
                $method = 'GET',
                $uri = "/api/messenger/messages/{$conference['uuid']}",
                $parameters = [],
                $files = [],
                $server = [
                    'HTTP_AUTHORIZATION' => "Bearer {$this->tester['jwt']}",
                ]
            );

            $response = $client->getResponse();

            $this->assertEquals(
                400,
                $response->getStatusCode()
            );
        }
    }
}
